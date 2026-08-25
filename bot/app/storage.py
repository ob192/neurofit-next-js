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
    #: The website click this client arrived from, if they arrived from one —
    #: the id the site put in the ``/start`` payload. It is how a booking made
    #: in this chat is attributed back to the ad that paid for it, and it is
    #: read every time a manager marks the conversation. See `Click`.
    click_id: str | None = None
    #: When a manager ran ``/qualified`` and ``/booked`` in this topic. Kept so
    #: each one reports to GA4 exactly once: these are key events, and a manager
    #: typing the command twice would otherwise sell the studio two bookings
    #: where there was one.
    qualified_at: str | None = None
    booked_at: str | None = None


@dataclass(frozen=True, slots=True)
class Click:
    """One click through to the bot from the website.

    Written by the site (`web/src/app/go/tg/route.ts`), read here. The bot never
    creates these — it only ever claims one that is already there — so every
    field is whatever the browser could tell the site at the time, and any of
    them can be missing. Someone who found the bot in Telegram search has no
    click at all, which is a normal state and not a fault.
    """

    id: str
    service_id: str | None = None
    #: GA4's identifiers for that visitor and visit. Without the client id a
    #: conversion cannot be attached to the campaign that produced it.
    ga_client_id: str | None = None
    ga_session_id: str | None = None
    gclid: str | None = None
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None
    utm_content: str | None = None
    utm_term: str | None = None
    landing_url: str | None = None
    created_at: str | None = None


class Store(Protocol):
    """What the relay needs. Reads are async because one backend is a network."""

    async def by_chat(self, chat_id: int) -> Client | None: ...
    async def by_topic(self, topic_id: int) -> Client | None: ...
    async def put(self, client: Client) -> Client: ...
    async def count(self) -> int: ...
    async def close(self) -> None: ...

    async def claim_click(self, click_id: str, chat_id: int) -> Click | None:
        """Looks up a click by the id the site handed to ``/start``.

        Marks it as belonging to this chat, so a link forwarded to a friend
        cannot re-attribute someone else's ad click to them.
        """
        ...

    async def click(self, click_id: str) -> Click | None:
        """Re-reads a claimed click. Used when a manager marks the lead, days on."""
        ...

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

    async def claim_click(self, click_id: str, chat_id: int) -> "Click | None":
        """Always ``None``: clicks are written by the website, into Postgres.

        The file backend is for a laptop and for tests, neither of which has a
        website pointing at them. A bot running on it still works — every client
        simply looks like they arrived without a click, which is what a client
        who typed the bot's name into Telegram search actually did.
        """
        return None

    async def click(self, click_id: str) -> "Click | None":
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
        click_id=row.get("click_id"),
        qualified_at=row.get("qualified_at"),
        booked_at=row.get("booked_at"),
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

-- Added after the fact, so it cannot live in the create above: existing
-- deployments already have the table.
alter table clients add column if not exists click_id text;
alter table clients add column if not exists qualified_at timestamptz;
alter table clients add column if not exists booked_at timestamptz;

-- The website's click log. **Written by the site, read here.**
--
-- The site has no migration mechanism and this is the only place in the project
-- that creates tables, so the schema is owned here even though the site is the
-- one inserting. The practical consequence is a deploy order: this bot first,
-- then the site. A site pointed at a database without this table logs nothing
-- and falls back to plain deep links, which is the behaviour it had before any
-- of this existed.
--
-- Nothing personal goes in here — no name, no phone, no message. It is a record
-- of an advertising click, and the reason it can be kept for months is that it
-- holds nothing else.
create table if not exists clicks (
    id            text primary key,
    created_at    timestamptz not null default now(),
    service_id    text,
    -- GA4's own visitor and visit ids, read from the first-party cookies. The
    -- client id is what lets a conversion sent days later still land on the
    -- campaign that produced it.
    ga_client_id  text,
    ga_session_id text,
    gclid         text,
    utm_source    text,
    utm_medium    text,
    utm_campaign  text,
    utm_content   text,
    utm_term      text,
    landing_url   text,
    user_agent    text,
    -- Set the first time a ``/start`` presents this id. A second chat quoting
    -- the same id is a forwarded link, not a second ad click, and is refused.
    claimed_at    timestamptz,
    claimed_by    bigint
);
create index if not exists clicks_claimed_by_idx on clicks (claimed_by);
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
                     last_format, last_ack_at, click_id,
                     qualified_at, booked_at)
                values ($1, $2, $3, coalesce($4, now()), $5, $6, $7, $8, $9, $10)
                on conflict (chat_id) do update set
                    topic_id    = excluded.topic_id,
                    name        = excluded.name,
                    username    = excluded.username,
                    last_format = excluded.last_format,
                    last_ack_at = excluded.last_ack_at,
                    -- These three only ever go from unset to set. The first
                    -- click a client arrived from is the one that earned them,
                    -- and a manager's mark is a thing that happened — a
                    -- returning visitor pressing start again, or any caller
                    -- that writes a record without them, must not erase either.
                    -- Each is also reported to GA4 exactly once, so silently
                    -- clearing one would let it be reported twice.
                    click_id     = coalesce(clients.click_id, excluded.click_id),
                    qualified_at = coalesce(clients.qualified_at, excluded.qualified_at),
                    booked_at    = coalesce(clients.booked_at, excluded.booked_at)
                """,
                client.chat_id,
                client.topic_id,
                client.name,
                _ts(client.created_at),
                client.username,
                client.last_format,
                _ts(client.last_ack_at),
                client.click_id,
                _ts(client.qualified_at),
                _ts(client.booked_at),
            )
        return client

    async def update(self, client: Client, **changes: object) -> Client:
        return await self.put(_updated(client, changes))

    async def close(self) -> None:
        await self._pool.close()

    # ---- The website's click log ---------------------------------------

    async def claim_click(self, click_id: str, chat_id: int) -> Click | None:
        """Claims an unclaimed click, or re-reads one this chat already owns.

        The `claimed_by is null or claimed_by = $2` guard is what stops a
        forwarded link from re-attributing an ad click: the first Telegram
        account to present the id keeps it, and anyone else who opens the same
        link is treated as having arrived without one.
        """
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                update clicks
                   set claimed_at = coalesce(claimed_at, now()),
                       claimed_by = $2
                 where id = $1
                   and (claimed_by is null or claimed_by = $2)
             returning *
                """,
                click_id,
                chat_id,
            )
        return self._click(row)

    async def click(self, click_id: str) -> Click | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow("select * from clicks where id = $1", click_id)
        return self._click(row)

    @staticmethod
    def _click(row) -> Click | None:  # noqa: ANN001 — asyncpg.Record
        if row is None:
            return None
        return Click(
            id=row["id"],
            service_id=row["service_id"],
            ga_client_id=row["ga_client_id"],
            ga_session_id=row["ga_session_id"],
            gclid=row["gclid"],
            utm_source=row["utm_source"],
            utm_medium=row["utm_medium"],
            utm_campaign=row["utm_campaign"],
            utm_content=row["utm_content"],
            utm_term=row["utm_term"],
            landing_url=row["landing_url"],
            created_at=_iso(row["created_at"]),
        )

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
            click_id=row["click_id"],
            qualified_at=_iso(row["qualified_at"]),
            booked_at=_iso(row["booked_at"]),
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
