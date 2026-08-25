"""The two marks a manager can put on a conversation, and the help behind them.

A lead is only worth measuring at the points a human judges it. The bot can see
that somebody asked for a format; it cannot see that they were serious, and it
certainly cannot see that they turned up. Those are the two facts advertising
needs back, and the only place they exist is in a manager's head.

So: ``/qualified`` and ``/booked``, typed into the client's topic. No arguments,
nothing to remember, and the same shape as the ``//`` note that is already the
studio's one piece of syntax.

**This router must be registered before `studio.py`.** That one relays anything
a manager writes to the client and bails out of any line starting with ``/`` —
so a command reaching it first would be silently swallowed, exactly as `/id`
would be. Same reason, same fix, see `setup.py`.
"""

from __future__ import annotations

import logging

from aiogram import F, Router
from aiogram.enums import ParseMode
from aiogram.filters import Command
from aiogram.types import Message

from ..content import studio
from ..relay import Relay
from ..storage import Client

log = logging.getLogger(__name__)

router = Router(name="commands")
router.message.filter(F.chat.type.in_({"group", "supergroup"}))


async def _client_here(message: Message, relay: Relay) -> Client | None:
    """The client whose topic this command was typed into, if it is one."""
    topic_id = message.message_thread_id
    if topic_id is None:
        return None
    return await relay.client_for_topic(topic_id)


async def _mark(
    message: Message, relay: Relay, *, field: str, event: str, note: str
) -> None:
    """Records a manager's judgement in the topic and reports it to GA4.

    The reply goes into the thread and never to the client: this is the studio
    talking to itself, and a customer receiving "лід позначено як якісний" would
    be a memorable way to lose them.

    Each mark reports once. A manager who types the command again — because
    they forgot, or because two of them are working the same thread — gets a
    note saying so, and GA4 is not told the studio sold a second session.
    """
    client = await _client_here(message, relay)
    if client is None:
        await message.reply(studio.NOT_A_CLIENT_TOPIC)
        return

    if getattr(client, field):
        await message.reply(studio.ALREADY_MARKED)
        return

    client = await relay.mark(client, field)
    await message.reply(note, parse_mode=ParseMode.HTML)

    if not client.click_id:
        # Worth saying out loud rather than failing quietly: a manager who marks
        # ten leads and sees nothing in the ad reports should know it is because
        # these people did not come from an ad, not because the mark is broken.
        await message.reply(studio.NO_ATTRIBUTION, parse_mode=ParseMode.HTML)
        return

    await relay.report_lead(client, event)


@router.message(Command("qualified"))
async def on_qualified(message: Message, relay: Relay) -> None:
    await _mark(
        message,
        relay,
        field="qualified_at",
        event="qualify_lead",
        note=studio.QUALIFIED,
    )


@router.message(Command("booked"))
async def on_booked(message: Message, relay: Relay) -> None:
    await _mark(
        message,
        relay,
        field="booked_at",
        event="close_convert_lead",
        note=studio.CONVERTED,
    )


@router.message(Command("help"))
async def on_help(message: Message) -> None:
    await message.reply(studio.HELP, parse_mode=ParseMode.HTML)
