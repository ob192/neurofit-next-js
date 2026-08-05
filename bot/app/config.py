"""Environment the bot needs, validated once at startup.

Both required values are things only the studio can supply, and both fail in
confusing ways if they are wrong — a bad token looks like a network problem, a
bad group id looks like the bot ignoring people. Checking them here turns either
one into a single readable line on stdout.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


class ConfigError(RuntimeError):
    """Raised when the environment cannot produce a working bot."""


@dataclass(frozen=True, slots=True)
class Config:
    token: str
    #: The studio's group. Negative, and for a supergroup it starts ``-100``.
    #:
    #: ``None`` is a legitimate state, not a failure: the id can only be read
    #: from inside the group, and the only tool for reading it is this bot. With
    #: it unset the bot boots into setup mode, answers ``/id`` and nothing else.
    group_chat_id: int | None
    state_file: Path
    #: Postgres for the client→topic mapping. Unset falls back to `state_file`,
    #: which is fine for a laptop and a liability for a container without a
    #: volume — see `storage.py`.
    database_url: str | None


def load_config(env: dict[str, str] | None = None) -> Config:
    source = os.environ if env is None else env

    token = (source.get("TELEGRAM_BOT_TOKEN") or "").strip()
    if not token:
        raise ConfigError(
            "TELEGRAM_BOT_TOKEN is not set. Create a bot with @BotFather and put "
            "its token in bot/.env"
        )

    raw_group = (source.get("TELEGRAM_GROUP_CHAT_ID") or "").strip()
    group_chat_id: int | None = None

    if raw_group:
        try:
            group_chat_id = int(raw_group)
        except ValueError as error:
            raise ConfigError(
                f"TELEGRAM_GROUP_CHAT_ID is not a number: {raw_group!r}"
            ) from error

        if group_chat_id >= 0:
            raise ConfigError(
                f"TELEGRAM_GROUP_CHAT_ID should be negative (a group), got "
                f"{group_chat_id}. A positive id is a private chat."
            )

    state_file = (source.get("BOT_STATE_FILE") or "").strip() or "data/state.json"
    database_url = (source.get("DATABASE_URL") or "").strip() or None

    return Config(
        token=token,
        group_chat_id=group_chat_id,
        state_file=Path(state_file),
        database_url=database_url,
    )
