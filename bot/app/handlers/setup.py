"""`/id` — the one command that has to work before the bot is configured.

A group's chat id can only be read from inside the group, and this bot is the
thing that reads it. So this router carries no chat filter and is registered
first: it answers `/id` in whatever group it is asked, including before
``TELEGRAM_GROUP_CHAT_ID`` has ever been set.
"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.enums import ParseMode
from aiogram.filters import Command
from aiogram.types import Message

from ..content import studio

router = Router(name="setup")
router.message.filter(F.chat.type.in_({"group", "supergroup"}))


@router.message(Command("id"))
async def on_id(message: Message) -> None:
    await message.answer(
        studio.chat_id(message.chat.id, message.message_thread_id),
        parse_mode=ParseMode.HTML,
    )
