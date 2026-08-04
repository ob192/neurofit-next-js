"""The bot's only persistent state: which client owns which topic.

A JSON file rather than a database, matching the project's standing rule that
nothing gets a database until something actually needs one. The volume this has
to survive is one row per client who ever pressed start, and the access pattern
is a keyed lookup — a file the studio can open and read is worth more here than
a query engine.

Losing the file is recoverable but not free: existing topics stay in the group,
and the next message from a known client opens a *second* topic for them. Back
it up with the rest of the host's data.
"""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import asdict, dataclass, replace
from pathlib import Path


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


class Store:
    """Client records, persisted as one small file.

    The polling offset is deliberately *not* kept here: aiogram confirms updates
    with Telegram as it processes them, so a restart resumes from the server's
    own cursor and a second copy would only ever disagree with it.
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self._by_chat: dict[int, Client] = {}
        self._by_topic: dict[int, Client] = {}
        # Writes are serialised rather than fired concurrently: two overlapping
        # saves would race on the same temp path and could leave the newer one
        # behind.
        self._lock = asyncio.Lock()

    @classmethod
    def load(cls, path: Path) -> "Store":
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
            client = Client(
                chat_id=int(row["chat_id"]),
                topic_id=int(row["topic_id"]),
                name=str(row.get("name") or ""),
                created_at=str(row.get("created_at") or ""),
                username=row.get("username"),
                last_format=row.get("last_format"),
                last_ack_at=row.get("last_ack_at"),
            )
            store._index(client)
        return store

    def _index(self, client: Client) -> None:
        previous = self._by_chat.get(client.chat_id)
        if previous is not None:
            self._by_topic.pop(previous.topic_id, None)
        self._by_chat[client.chat_id] = client
        self._by_topic[client.topic_id] = client

    # ---- Reads ---------------------------------------------------------

    def by_chat(self, chat_id: int) -> Client | None:
        return self._by_chat.get(chat_id)

    def by_topic(self, topic_id: int) -> Client | None:
        return self._by_topic.get(topic_id)

    # ---- Writes --------------------------------------------------------

    async def put(self, client: Client) -> Client:
        self._index(client)
        await self.save()
        return client

    async def update(self, client: Client, **changes: object) -> Client:
        """Replaces fields on a record and persists it."""
        updated = replace(client, **changes)  # type: ignore[arg-type]
        return await self.put(updated)

    async def save(self) -> None:
        """Writes the whole file, atomically.

        A half-written state file is worse than a slightly stale one, because it
        loses every mapping at once rather than the last change.
        """
        async with self._lock:
            snapshot = json.dumps(
                {
                    "version": 1,
                    "clients": [asdict(c) for c in self._by_chat.values()],
                },
                ensure_ascii=False,
                indent=2,
            )
            await asyncio.to_thread(self._write, snapshot)

    def _write(self, snapshot: str) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        temp = self._path.with_suffix(f"{self._path.suffix}.tmp")
        temp.write_text(snapshot, encoding="utf-8")
        os.replace(temp, self._path)
