"""The bot's only persistent state: which client owns which topic.

Losing this mapping is the single most expensive failure the bot has. The bot
cannot ask Telegram which topic belonged to whom — the Bot API has no way to
list forum topics — so a forgotten client gets a **brand new topic**, and their
history is stranded in a thread nobody will look at again.

Two backends, chosen by whether ``DATABASE_URL`` is set:

``PostgresStore``
    What production runs. State outlives the container, survives a redeploy
    that forgets to mount a volume, and is shared if more than one instance
    ever exists.

``JsonStore``
    A file. What tests and a laptop run, so neither needs a database. Fine for
    one process with a volume behind it; the failure mode it *cannot* survive
    is the one above.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import asdict, dataclass, replace
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class Client:
    chat_id: int
    topic_id: int
    name: str
    #: ISO timestamp of the first ``/start``.
    created_at: str
    username: str | None = None
    #: Last format requested, for the studio's benefit.
    last_format: str | None = None
    #: When the bot last told this client "your message was passed on". Kept so
    #: the acknowledgement fires once per conversation rather than after every
    #: line of a three-message thought.
    last_ack_at: str | None = None


class Store(Protocol):
    """What the relay needs. Reads are async because one backend is a network."""

    async def by_chat(self, chat_id: int) -> Client | None: ...
    async def by_topic(self, topic_id: int) -> Client | None: ...
    async def put(self, client: Client) -> Client: ...
    async def count(self) -> int: ...
    async def close(self) -> None: ...

    async def update(self, client: Client, **changes: object) -> Client:
        """Replaces fields on a record and persists it."""
        ...


def _updated(client: Client, changes: dict[str, object]) -> Client:
    return replace(client, **changes)  # type: ignore[arg-type]


# ---- JSON file ----------------------------------------------------------


class JsonStore:
    """Client records in one small file, written atomically."""

    def __init__(self, path: Path) -> None:
        self._path = path
        self._by_chat: dict[int, Client] = {}
        self._by_topic: dict[int, Client] = {}
        # Writes are serialised rather than fired concurrently: two overlapping
        # saves would race on the same temp path and could leave the newer one
        # behind.
        self._lock = asyncio.Lock()

    @classmethod
    def load(cls, path: Path) -> "JsonStore":
        store = cls(path)
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return store
        except json.JSONDecodeError as error:
            raise RuntimeError(
                f"{path} is not valid JSON ({error}). Fix or delete it — deleting "
                "loses the client→topic mapping and re-opens topics from scratch."
            ) from error

        for row in raw.get("clients") or []:
            store._index(_client_from_row(row))
        return store

    def ensure_writable(self) -> None:
        """Fails now rather than after the first client has been forgotten.

        An unwritable state file is invisible until a restart, at which point
        every client is a stranger again and gets a second topic.
        """
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            probe = self._path.with_suffix(f"{self._path.suffix}.probe")
            probe.write_text("", encoding="utf-8")
            probe.unlink()
        except OSError as error:
            raise RuntimeError(
                f"Cannot write the state file at {self._path} ({error}). Without it "
                "the bot forgets every client on restart and opens a second topic "
                "for each of them. In Docker, leave BOT_STATE_FILE unset and mount "
                "a volume at /data — or set DATABASE_URL and use Postgres."
            ) from error

    def _index(self, client: Client) -> None:
        previous = self._by_chat.get(client.chat_id)
        if previous is not None:
            self._by_topic.pop(previous.topic_id, None)
        self._by_chat[client.chat_id] = client
        self._by_topic[client.topic_id] = client

    async def by_chat(self, chat_id: int) -> Client | None:
        return self._by_chat.get(chat_id)

    async def by_topic(self, topic_id: int) -> Client | None:
        return self._by_topic.get(topic_id)

    async def count(self) -> int:
        return len(self._by_chat)

    async def put(self, client: Client) -> Client:
        self._index(client)
        await self._save()
        return client

    async def update(self, client: Client, **changes: object) -> Client:
        return await self.put(_updated(client, changes))

    async def close(self) -> None:
        return None

    def all(self) -> list[Client]:
        return list(self._by_chat.values())

    async def _save(self) -> None:
        """Writes the whole file, atomically.

        A half-written state file is worse than a slightly stale one, because it
        loses every mapping at once rather than the last change.
        """
        async with self._lock:
            snapshot = json.dumps(
                {"version": 1, "clients": [asdict(c) for c in self._by_chat.values()]},
                ensure_ascii=False,
                indent=2,
            )
            await asyncio.to_thread(self._write, snapshot)

    def _write(self, snapshot: str) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp = self._path.with_suffix(f"{self._path.suffix}.tmp")
        temp.write_text(snapshot, encoding="utf-8")
        os.replace(temp, self._path)


def _client_from_row(row: dict) -> Client:
    return Client(
        chat_id=int(row["chat_id"]),
        topic_id=int(row["topic_id"]),
        name=str(row.get("name") or ""),
        created_at=str(row.get("created_at") or ""),
        username=row.get("username"),
        last_format=row.get("last_format"),
        last_ack_at=row.get("last_ack_at"),
    )


# ---- Postgres -----------------------------------------------------------

SCHEMA = """
create table if not exists clients (
    chat_id     bigint primary key,
    topic_id    bigint not null,
    name        text   not null default '',
    created_at  timestamptz not null default now(),
    username    text,
    last_format text,
    last_ack_at timestamptz
);
-- One topic belongs to exactly one client. If this ever trips, a bug handed
-- two clients the same thread, and failing loudly beats cross-posting their
-- conversations to each other.
create unique index if not exists clients_topic_id_key on clients (topic_id);
"""


def _ts(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat(timespec="seconds") if value else None


class PostgresStore:
    """Client records in Postgres.

    Every read goes to the database rather than an in-memory cache. The table
    holds one row per client who has ever pressed start and is queried once per
    update, so a cache would buy nothing measurable and would be wrong the
    moment a second instance existed.
    """

    def __init__(self, pool) -> None:  # noqa: ANN001 — asyncpg.Pool
        self._pool = pool

    @classmethod
    async def connect(cls, dsn: str) -> "PostgresStore":
        import asyncpg

        pool = await asyncpg.create_pool(
            dsn,
            min_size=1,
            max_size=5,
            # Neon's pooled endpoint is PgBouncer in transaction mode, which
            # cannot carry asyncpg's prepared-statement cache between queries.
            statement_cache_size=0,
            # A scale-to-zero database takes a few seconds to wake.
            command_timeout=30,
        )
        async with pool.acquire() as conn:
            await conn.execute(SCHEMA)
        return cls(pool)

    async def by_chat(self, chat_id: int) -> Client | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("select * from clients where chat_id = $1", chat_id)
        return self._row(row)

    async def by_topic(self, topic_id: int) -> Client | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "select * from clients where topic_id = $1", topic_id
            )
        return self._row(row)

    async def count(self) -> int:
        async with self._pool.acquire() as conn:
            return int(await conn.fetchval("select count(*) from clients") or 0)

    async def put(self, client: Client) -> Client:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                insert into clients
                    (chat_id, topic_id, name, created_at, username,
                     last_format, last_ack_at)
                values ($1, $2, $3, coalesce($4, now()), $5, $6, $7)
                on conflict (chat_id) do update set
                    topic_id    = excluded.topic_id,
                    name        = excluded.name,
                    username    = excluded.username,
                    last_format = excluded.last_format,
                    last_ack_at = excluded.last_ack_at
                """,
                client.chat_id,
                client.topic_id,
                client.name,
                _ts(client.created_at),
                client.username,
                client.last_format,
                _ts(client.last_ack_at),
            )
        return client

    async def update(self, client: Client, **changes: object) -> Client:
        return await self.put(_updated(client, changes))

    async def close(self) -> None:
        await self._pool.close()

    @staticmethod
    def _row(row) -> Client | None:  # noqa: ANN001 — asyncpg.Record
        if row is None:
            return None
        return Client(
            chat_id=row["chat_id"],
            topic_id=row["topic_id"],
            name=row["name"] or "",
            created_at=_iso(row["created_at"]) or "",
            username=row["username"],
            last_format=row["last_format"],
            last_ack_at=_iso(row["last_ack_at"]),
        )


# ---- Choosing one -------------------------------------------------------


async def open_store(database_url: str | None, state_file: Path) -> Store:
    """Postgres when configured, the file otherwise.

    On the first Postgres run, an existing state file is imported: the mapping
    it holds is the only record of which topic belongs to whom, and dropping it
    would open a second topic for every client the studio already has.
    """
    if not database_url:
        store = JsonStore.load(state_file)
        store.ensure_writable()
        log.info("state: %s (%d clients)", state_file, await store.count())
        return store

    store = await PostgresStore.connect(database_url)
    existing = await store.count()

    if existing == 0 and state_file.exists():
        imported = JsonStore.load(state_file)
        for client in imported.all():
            await store.put(client)
        existing = await store.count()
        log.info("state: imported %d client(s) from %s", existing, state_file)

    log.info("state: postgres (%d clients)", existing)
    return store
