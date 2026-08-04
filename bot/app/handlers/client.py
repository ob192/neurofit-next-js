"""The client's side of the conversation: a private chat with the bot.

Three things can happen here — the client starts the bot, presses a format
button, or writes something. The first two are the booking flow; the third is
handed straight to a manager, because a bot that improvises answers about
prices, contraindications or free slots would be answering for the studio.
"""

from __future__ import annotations

from aiogram import F, Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import CallbackQuery, Message

from ..content import BOOKING_BUTTON, Format, find_format, messages, studio
from ..keyboards import BookFormat, booking_keyboard, formats_keyboard
from ..relay import Relay
from ..storage import Client

router = Router(name="client")
router.message.filter(F.chat.type == "private")


@router.message(CommandStart())
async def on_start(message: Message, command: CommandObject, relay: Relay) -> None:
    if message.from_user is None:
        return

    # `/start <payload>`: the website's per-format CTAs pass a service id here,
    # e.g. https://t.me/<bot>?start=ems
    payload = (command.args or "").strip()
    fmt = find_format(payload) if payload else None

    client = await relay.ensure_client(
        message.chat.id,
        message.from_user,
        source=f"сайт · {fmt.name}" if fmt else ("сайт" if payload else None),
    )
    if client is None:
        return

    await relay.log_to_studio(client, studio.STARTED)
    await relay.say(client, messages.GREETING, booking_keyboard())

    if fmt is not None:
        # The visitor already answered "which format?" by clicking a specific
        # CTA on the site. Asking again would be a step backwards.
        await relay.say(
            client,
            f"{messages.format_chosen(fmt.name)}\n\n{messages.WAIT_MANAGER}",
        )
        await _record_request(relay, client, fmt)
        return

    await relay.say(client, messages.BOOKING, formats_keyboard())


@router.message(F.text == BOOKING_BUTTON)
async def on_booking_button(message: Message, relay: Relay) -> None:
    if message.from_user is None:
        return

    client = await relay.ensure_client(message.chat.id, message.from_user)
    if client is None:
        return

    await relay.log_to_studio(client, studio.TAPPED_BOOKING_BUTTON)
    await relay.say(client, messages.BOOKING, formats_keyboard())


@router.callback_query(BookFormat.filter())
async def on_format_chosen(
    query: CallbackQuery, callback_data: BookFormat, relay: Relay
) -> None:
    fmt = find_format(callback_data.format_id)
    if fmt is None:
        await query.answer(messages.CALLBACK_STALE)
        return

    await query.answer(messages.CALLBACK_ACK)

    message = query.message
    if message is None or message.chat.type != "private":
        return

    client = await relay.ensure_client(message.chat.id, query.from_user)
    if client is None:
        return

    # Retire the prompt in place. Leaving the buttons live invites a second and
    # third tap, each of which reads to the studio as another request.
    try:
        await message.edit_text(messages.booking_answered(fmt.name))
    except Exception:  # noqa: BLE001 — too old to edit, or already edited.
        pass

    await relay.say(client, messages.WAIT_MANAGER)
    await _record_request(relay, client, fmt)


@router.message()
async def on_any_message(message: Message, relay: Relay) -> None:
    """Everything else is conversation: it belongs to a manager, not to the bot."""
    if message.from_user is None:
        return

    client = await relay.ensure_client(message.chat.id, message.from_user)
    if client is None:
        return

    await relay.relay_to_studio(client, message)
    await relay.acknowledge(client)


async def _record_request(relay: Relay, client: Client, fmt: Format) -> None:
    """Marks the request in the studio topic and remembers the choice.

    This is the one message in a topic that is worth a notification — it is the
    moment a manager has something to do.
    """
    await relay.log_to_studio(client, studio.requested(fmt.name), notify=True)
    await relay.remember_format(client, fmt.id)
