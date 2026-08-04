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

from .content import messages, studio
from .keyboards import booking_keyboard
from .storage import Client, Store

log = logging.getLogger(__name__)

#: How long before the bot says "passed on to a manager" to the same client again.
ACK_INTERVAL_SECONDS = 30 * 60

#: Telegram's wording when the topic we are posting into no longer exists.
_MISSING_TOPIC_MARKERS = (
    "message thread not found",
    "topic_deleted",
    "topic_closed",
    "topic was closed",
)


def _is_missing_topic(error: TelegramAPIError) -> bool:
    return any(marker in str(error).lower() for marker in _MISSING_TOPIC_MARKERS)


def _now() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


class Relay:
    def __init__(self, bot: Bot, store: Store, group_chat_id: int) -> None:
        self._bot = bot
        self._store = store
        self._group_chat_id = group_chat_id

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
        existing = self._store.by_chat(chat_id)
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

    def client_for_topic(self, topic_id: int) -> Client | None:
        """Which client a studio topic belongs to, if any."""
        return self._store.by_topic(topic_id)

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

        await self.log_to_studio(
            client, mirror_as if mirror_as is not None else studio.bot_said(escape(text))
        )

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
        """Runs `action(topic_id)`, recreating the topic once if it is gone.

        Without the retry, deleting a thread would permanently disconnect that
        client: every later message from them would fail to post and be lost,
        while the bot kept telling them a manager was on the way.
        """
        try:
            await action(client.topic_id)
            return
        except TelegramBadRequest as error:
            if not _is_missing_topic(error):
                log.exception("cannot write to topic %s", client.topic_id)
                return
        except TelegramAPIError:
            log.exception("cannot write to topic %s", client.topic_id)
            return

        revived = await self._revive_topic(client)
        if revived is None:
            return

        try:
            await action(revived.topic_id)
        except TelegramAPIError:
            log.exception("cannot write to recreated topic %s", revived.topic_id)

    async def _revive_topic(self, client: Client) -> Client | None:
        try:
            topic = await self._bot.create_forum_topic(
                chat_id=self._group_chat_id,
                name=studio.topic_name(client.name, client.username),
            )
        except TelegramAPIError:
            log.exception("cannot recreate a topic for chat %s", client.chat_id)
            return None

        return await self._store.update(client, topic_id=topic.message_thread_id)

    async def _try_send(self, chat_id: int, text: str) -> None:
        try:
            await self._bot.send_message(
                chat_id=chat_id, text=text, reply_markup=booking_keyboard()
            )
        except TelegramAPIError:
            log.exception("cannot reach chat %s", chat_id)
