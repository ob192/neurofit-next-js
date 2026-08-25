"""The two-way bridge between a client's private chat and their studio topic.

Two directions, one rule each:

    client → studio   every message the client sends is copied into that
                      client's own topic in the studio's group
    studio → client   every message a manager writes in a client's topic is
                      copied back to that client

The topic *is* the conversation record — the bot's own messages are echoed into
it too, so a manager opening a thread sees exactly what the client saw.

Everything that talks to Telegram on behalf of a client goes through here, so
the handlers stay a description of the flow and the failure handling lives in
one place.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from html import escape
from aiogram import Bot
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramAPIError, TelegramBadRequest
from aiogram.types import InlineKeyboardMarkup, Message, ReplyKeyboardMarkup, User

from .analytics import Analytics
from .content import InfoAnswer, messages, studio
from .keyboards import booking_keyboard
from .storage import Click, Client, Store

log = logging.getLogger(__name__)

#: How long before the bot says "passed on to a manager" to the same client again.
ACK_INTERVAL_SECONDS = 30 * 60

#: GA4's default session timeout. A click older than this belongs to a visit
#: that has ended, so the events that follow it are sent without a session id
#: and let GA4 attribute them through its own model — see `analytics.py`.
GA4_SESSION_TIMEOUT_SECONDS = 30 * 60

#: Sentinel for `say(mirror_as=…)`: send to the client, write nothing to the
#: topic. Used by the canned answers, which log one marker for the whole answer.
_SKIP_MIRROR = ""

#: Telegram's wording when the topic is *gone*. Nothing can be done but open a
#: new one — the Bot API cannot resurrect a deleted thread.
_DELETED_TOPIC_MARKERS = ("message thread not found", "topic_deleted")

#: Telegram's wording when the topic still exists but is closed. Closing is
#: ordinary housekeeping — a manager tidying up a finished conversation — so
#: the thread is reopened rather than replaced. Replacing it would scatter one
#: client across as many threads as the studio has tidied.
_CLOSED_TOPIC_MARKERS = ("topic_closed", "topic was closed", "topic is closed")


def _matches(error: TelegramAPIError, markers: tuple[str, ...]) -> bool:
    return any(marker in str(error).lower() for marker in markers)


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class Relay:
    def __init__(
        self,
        bot: Bot,
        store: Store,
        group_chat_id: int,
        analytics: Analytics | None = None,
    ) -> None:
        self._bot = bot
        self._store = store
        self._group_chat_id = group_chat_id
        self._analytics = analytics or Analytics(None, None)

    # ---- Topics ---------------------------------------------------------

    async def ensure_client(
        self, chat_id: int, user: User, source: str | None = None
    ) -> Client | None:
        """Finds the client's topic, opening one the first time we see them.

        Returns ``None`` if the group is unusable — not a forum, or one the bot
        cannot manage topics in. The client is then told to phone instead,
        because silently swallowing their request is the one outcome the studio
        cannot recover from.
        """
        existing = await self._store.by_chat(chat_id)
        if existing is not None:
            return existing

        name = " ".join(filter(None, (user.first_name, user.last_name)))

        try:
            topic = await self._bot.create_forum_topic(
                chat_id=self._group_chat_id,
                name=studio.topic_name(name, user.username),
            )
        except TelegramAPIError:
            log.exception("cannot create a topic for chat %s", chat_id)
            await self._try_send(chat_id, messages.RELAY_UNAVAILABLE)
            return None

        client = await self._store.put(
            Client(
                chat_id=chat_id,
                topic_id=topic.message_thread_id,
                name=name,
                created_at=_now(),
                username=user.username,
            )
        )

        await self.log_to_studio(
            client,
            studio.client_header(
                name=escape(name),
                chat_id=chat_id,
                username=escape(user.username) if user.username else None,
                source=escape(source) if source else None,
            ),
            notify=True,
        )
        return client

    async def client_for_topic(self, topic_id: int) -> Client | None:
        """Which client a studio topic belongs to, if any."""
        return await self._store.by_topic(topic_id)

    # ---- Bot → client ---------------------------------------------------

    async def say(
        self,
        client: Client,
        text: str,
        reply_markup: ReplyKeyboardMarkup | InlineKeyboardMarkup | None = None,
        *,
        html: bool = False,
        mirror_as: str | None = None,
    ) -> None:
        """Sends to the client *and* mirrors it into their topic.

        ``html`` is opt-in per call, and only ever set for the canned answers in
        `content.py` — constants with nothing interpolated into them. Anything
        carrying a client's own words stays unparsed, so a name containing `<`
        can never become markup or a send failure.

        ``mirror_as`` replaces what goes into the topic. The canned answers use
        it to log a one-line marker instead of repeating the whole price list.
        """
        try:
            await self._bot.send_message(
                chat_id=client.chat_id,
                text=text,
                parse_mode=ParseMode.HTML if html else None,
                reply_markup=reply_markup if reply_markup else booking_keyboard(),
            )
        except TelegramAPIError as error:
            await self.log_to_studio(
                client, studio.delivery_failed(escape(str(error))), notify=True
            )
            return

        if mirror_as == _SKIP_MIRROR:
            return
        await self.log_to_studio(
            client, mirror_as if mirror_as is not None else studio.bot_said(escape(text))
        )

    async def send_answer(self, client: Client, answer: InfoAnswer) -> None:
        """Sends a canned answer — one message per part — and marks it in the topic.

        The marker goes in once, not once per part: the studio needs to know the
        client asked about prices, not to have four price messages repeated at
        them. The parts themselves are never mirrored for the same reason.
        """
        for part in answer.parts:
            await self.say(client, part.text, html=True, mirror_as=_SKIP_MIRROR)

        await self.log_to_studio(client, studio.asked(answer.button))

    async def copy_to_client(self, client: Client, message: Message) -> None:
        """Hands a manager's message to the client.

        ``copy_message`` rather than ``forward_message``: forwarding would put
        the studio's group name and the manager's personal account on every
        reply.
        """
        try:
            await self._bot.copy_message(
                chat_id=client.chat_id,
                from_chat_id=message.chat.id,
                message_id=message.message_id,
                reply_markup=booking_keyboard(),
            )
        except TelegramAPIError as error:
            await self.log_to_studio(
                client, studio.delivery_failed(escape(str(error))), notify=True
            )

    async def remember_format(self, client: Client, format_id: str) -> Client:
        """Records the last format the client asked for."""
        return await self._store.update(client, last_format=format_id)

    async def mark(self, client: Client, field: str) -> Client:
        """Stamps one of the manager's marks (`qualified_at`, `booked_at`).

        Written before the event is sent, not after: if GA4 is unreachable the
        studio's own record still shows the mark, and the alternative — retrying
        until it lands — is how one booking becomes three conversions.
        """
        return await self._store.update(client, **{field: _now()})

    # ---- Attribution ----------------------------------------------------

    async def attach_click(self, client: Client, click_id: str) -> tuple[Client, Click | None]:
        """Ties this client to the website click they arrived from.

        Returns the client unchanged and ``None`` when the id is not ours: an
        old link, a forwarded one already claimed by somebody else, or a
        database that has not been given the table yet. None of those is an
        error the client should ever hear about — they get the same greeting
        either way, and the studio simply sees no campaign line in the topic.
        """
        if client.click_id == click_id:
            return client, await self._store.click(click_id)

        click = await self._store.claim_click(click_id, client.chat_id)
        if click is None:
            return client, None

        return await self._store.update(client, click_id=click_id), click

    async def report_lead(
        self, client: Client, event: str, params: dict[str, object] | None = None
    ) -> None:
        """Sends one funnel stage to GA4, if this client came from a click.

        The click row is re-read rather than cached on the client: a manager
        marking a lead may be doing it days later, in a process that has
        restarted since, and the row is the only place the visitor's GA4
        identity is written down.
        """
        if not client.click_id:
            return

        click = await self._store.click(client.click_id)
        if click is None:
            return

        await self._analytics.send(
            event,
            client_id=click.ga_client_id,
            session_id=self._live_session(click),
            params={
                "click_id": click.id,
                **({"service_id": click.service_id} if click.service_id else {}),
                **(params or {}),
            },
        )

    @staticmethod
    def _live_session(click: Click) -> str | None:
        """The GA4 session id, but only while that session is plausibly open.

        Replaying a session id from a visit that ended hours ago tells GA4 the
        visit is still running, which quietly corrupts session counts and
        engagement time for the campaign it belongs to. Past the timeout the
        event is better off carrying no session at all.
        """
        if not click.ga_session_id or not click.created_at:
            return None
        try:
            age = datetime.now(UTC) - datetime.fromisoformat(click.created_at)
        except ValueError:
            return None
        return click.ga_session_id if age.total_seconds() < GA4_SESSION_TIMEOUT_SECONDS else None

    async def acknowledge(self, client: Client) -> Client:
        """Reassures the client that a human will read what they wrote.

        Throttled: a client typing three lines should not get three identical
        replies from a bot that has nothing else to say.
        """
        if client.last_ack_at:
            try:
                since = datetime.now(UTC) - datetime.fromisoformat(client.last_ack_at)
                if since.total_seconds() < ACK_INTERVAL_SECONDS:
                    return client
            except ValueError:
                pass  # Unparseable timestamp — acknowledge and rewrite it.

        await self.say(client, messages.MESSAGE_FORWARDED)
        return await self._store.update(client, last_ack_at=_now())

    # ---- Client → studio ------------------------------------------------

    async def log_to_studio(
        self, client: Client, text: str, *, notify: bool = False
    ) -> None:
        """Posts HTML into the client's topic, reopening it if it went missing.

        Bot boilerplate goes in silently: a manager should be notified when a
        client writes, not when the bot repeats its own greeting.
        """

        async def send(topic_id: int) -> None:
            await self._bot.send_message(
                chat_id=self._group_chat_id,
                message_thread_id=topic_id,
                text=text,
                # HTML is enabled here and nowhere else. Client-facing text is
                # sent unparsed, so a name containing `<` can never turn into
                # markup — or into a send failure — on the way out.
                parse_mode=ParseMode.HTML,
                disable_notification=not notify,
            )

        await self._into_topic(client, send)

    async def relay_to_studio(self, client: Client, message: Message) -> None:
        """Copies a client's message — text, photo, voice, whatever — into their topic."""

        async def copy(topic_id: int) -> None:
            await self._bot.copy_message(
                chat_id=self._group_chat_id,
                message_thread_id=topic_id,
                from_chat_id=message.chat.id,
                message_id=message.message_id,
            )

        await self._into_topic(client, copy)

    # ---- Plumbing -------------------------------------------------------

    async def _into_topic(self, client: Client, action) -> None:  # noqa: ANN001
        """Runs `action(topic_id)`, healing the topic once if it will not take it.

        The record is re-read from the store first, and that is not a
        micro-optimisation. Handling a single `/start` writes to the topic three
        or four times, and each caller holds the `Client` it was given at the
        top. If the first write heals the topic, every later one would still be
        pointing at the dead id — and would heal it *again*, opening a fresh
        thread per write. Re-reading is what makes one broken topic cost one
        repair instead of four.
        """
        current = await self._store.by_chat(client.chat_id) or client

        try:
            await action(current.topic_id)
            return
        except TelegramBadRequest as error:
            repaired = await self._repair_topic(current, error)
        except TelegramAPIError:
            log.exception("cannot write to topic %s", current.topic_id)
            return

        if repaired is None:
            return

        try:
            await action(repaired.topic_id)
        except TelegramAPIError:
            log.exception("cannot write to repaired topic %s", repaired.topic_id)

    async def _repair_topic(
        self, client: Client, error: TelegramBadRequest
    ) -> Client | None:
        """Reopens a closed topic, or opens a new one if it is really gone."""
        if _matches(error, _CLOSED_TOPIC_MARKERS):
            try:
                await self._bot.reopen_forum_topic(
                    chat_id=self._group_chat_id, message_thread_id=client.topic_id
                )
            except TelegramAPIError:
                log.exception("cannot reopen topic %s", client.topic_id)
                return None
            log.info("reopened topic %s for chat %s", client.topic_id, client.chat_id)
            return client

        if not _matches(error, _DELETED_TOPIC_MARKERS):
            log.error("cannot write to topic %s: %s", client.topic_id, error)
            return None

        try:
            topic = await self._bot.create_forum_topic(
                chat_id=self._group_chat_id,
                name=studio.topic_name(client.name, client.username),
            )
        except TelegramAPIError:
            log.exception("cannot recreate a topic for chat %s", client.chat_id)
            return None

        log.info(
            "topic %s is gone; opened %s for chat %s",
            client.topic_id,
            topic.message_thread_id,
            client.chat_id,
        )
        return await self._store.update(client, topic_id=topic.message_thread_id)

    async def _try_send(self, chat_id: int, text: str) -> None:
        try:
            await self._bot.send_message(
                chat_id=chat_id, text=text, reply_markup=booking_keyboard()
            )
        except TelegramAPIError:
            log.exception("cannot reach chat %s", chat_id)
