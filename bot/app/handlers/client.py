"""The client's side of the conversation: a private chat with the bot.

Three things can happen here — the client starts the bot, presses a format
button, or writes something. The first two are the booking flow; the third is
handed straight to a manager, because a bot that improvises answers about
prices, contraindications or free slots would be answering for the studio.
"""

from __future__ import annotations

from html import escape

from aiogram import F, Router
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import CallbackQuery, Message

from ..content import (
    BOOKING_BUTTON,
    INFO_BUTTONS,
    INFO_BY_BUTTON,
    Format,
    find_format,
    messages,
    studio,
)
from ..keyboards import BookFormat, booking_keyboard, formats_keyboard
from ..relay import Relay
from ..storage import Click, Client

router = Router(name="client")
router.message.filter(F.chat.type == "private")


@router.message(CommandStart())
async def on_start(message: Message, command: CommandObject, relay: Relay) -> None:
    if message.from_user is None:
        return

    # `/start <payload>`. Two shapes, and both have to keep working:
    #
    #   <click id>  what the site sends now — an opaque id standing for a row in
    #               the `clicks` table, which is where the format and the
    #               campaign that produced this visit are written down
    #   ems         the older, plainer form: the service id itself. Still sent
    #               when the site could not log the click, and still what a
    #               hand-written or bookmarked link carries
    #
    # A click id is 22 random characters and a format id is one of three known
    # words, so trying formats first cannot be ambiguous.
    payload = (command.args or "").strip()
    fmt = find_format(payload) if payload else None

    client = await relay.ensure_client(
        message.chat.id,
        message.from_user,
        source=f"сайт · {fmt.name}" if fmt else ("сайт" if payload else None),
    )
    if client is None:
        return

    click: Click | None = None
    if payload and fmt is None:
        client, click = await relay.attach_click(client, payload)
        if click is not None and click.service_id:
            fmt = find_format(click.service_id)

    await relay.log_to_studio(client, studio.STARTED)
    if click is not None:
        # Posted into the topic rather than kept for the reports alone: a
        # manager opening a thread should be able to see that this person came
        # in on a paid ad, which is worth knowing before answering them.
        await _log_attribution(relay, client, click)

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


@router.message(F.text.in_(INFO_BUTTONS))
async def on_info_button(message: Message, relay: Relay) -> None:
    """Answers one of the four standing questions.

    Registered above the catch-all below, so these never reach a manager as raw
    text — the topic gets a one-line marker instead.
    """
    info = INFO_BY_BUTTON.get(message.text or "")
    if info is None or message.from_user is None:
        return

    client = await relay.ensure_client(message.chat.id, message.from_user)
    if client is None:
        return

    await relay.send_answer(client, info)


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
    moment a manager has something to do. It is also the first stage of the
    funnel the bot can see for itself: the visitor did not merely open the chat,
    they said what they want. `generate_lead` was already sent by the website
    when they clicked; this is the step after it.
    """
    await relay.log_to_studio(client, studio.requested(fmt.name), notify=True)
    client = await relay.remember_format(client, fmt.id)
    await relay.report_lead(client, "working_lead", {"service_id": fmt.id})


async def _log_attribution(relay: Relay, client: Client, click: Click) -> None:
    """Writes the campaign line into the topic, when there is one to write."""
    line = studio.attribution(
        source=escape(click.utm_source) if click.utm_source else None,
        medium=escape(click.utm_medium) if click.utm_medium else None,
        campaign=escape(click.utm_campaign) if click.utm_campaign else None,
        is_ads=bool(click.gclid),
    )
    if line:
        await relay.log_to_studio(client, line)
