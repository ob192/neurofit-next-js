"""NeuroFit booking bot.

Takes training requests in Telegram and gives every client their own topic in
the studio's group chat, so managers answer everyone from one place.
"""

import os
from pathlib import Path

_VERSION_FILE = Path(__file__).resolve().parent.parent / "VERSION"


def version() -> str:
    """What is running.

    `BOT_VERSION` is baked into the image by `make build` and carries the build
    it was cut from ("0.1.0-a10a373"); outside a container it falls back to the
    plain version in `bot/VERSION`. Never raises — a bot that will not start
    because it cannot read its own version number is worse than one that says
    "unknown".
    """
    stamped = os.environ.get("BOT_VERSION", "").strip()
    if stamped:
        return stamped
    try:
        return _VERSION_FILE.read_text(encoding="utf-8").strip() or "unknown"
    except OSError:
        return "unknown"


__all__ = ["version"]
