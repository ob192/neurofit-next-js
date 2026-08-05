"""The studio's side: the group chat, one topic per client.

A manager answers a client by writing in that client's topic — no command, no
reply-to, nothing to remember. That is the whole interface, and it is why the
relay is worth having at all: the studio works in one chat instead of in as many
private conversations as it has clients.

One escape hatch: a line starting with ``//`` stays in the topic. (``/id`` lives
in `setup.py`, which is registered ahead of this router because it has to work
before the group is configured.)
"""

from __future__ import annotations

from aiogram import Bot, F, Router
from aiogram.enums import ContentType
from aiogram.types import Message

from ..relay import Relay

router = Router(name="studio")
# The chat-id filter is attached at startup, in __main__, where the config is
# known. Without it this router would relay any group the bot is added to.
router.message.filter(F.chat.type.in_({"group", "supergroup"}))

#: A manager's note to the rest of the studio, not to the client.
INTERNAL_NOTE_PREFIX = "//"

#: Telegram's own announcements ("topic created", "N joined") are not conversation.
SERVICE_CONTENT = frozenset(
    {
        ContentType.FORUM_TOPIC_CREATED,
        ContentType.FORUM_TOPIC_EDITED,
        ContentType.FORUM_TOPIC_CLOSED,
        ContentType.FORUM_TOPIC_REOPENED,
        ContentType.GENERAL_FORUM_TOPIC_HIDDEN,
        ContentType.GENERAL_FORUM_TOPIC_UNHIDDEN,
        ContentType.NEW_CHAT_MEMBERS,
        ContentType.LEFT_CHAT_MEMBER,
        ContentType.NEW_CHAT_TITLE,
        ContentType.NEW_CHAT_PHOTO,
        ContentType.PINNED_MESSAGE,
    }
)


@router.message()
async def on_manager_message(message: Message, bot: Bot, relay: Relay) -> None:
    if message.content_type in SERVICE_CONTENT:
        return

    # Only the bot's own messages are filtered out, not every bot: a manager who
    # posts anonymously appears as GroupAnonymousBot, and dropping those would
    # silently lose the replies of exactly the people most likely to be admins.
    if message.from_user is not None and message.from_user.id == bot.id:
        return

    topic_id = message.message_thread_id
    if topic_id is None:
        return  # The General thread, which belongs to no client.

    client = await relay.client_for_topic(topic_id)
    if client is None:
        return  # A topic the studio opened by hand. Not ours to relay.

    text = (message.text or message.caption or "").lstrip()
    # `//` keeps a note in the thread; a bare `/command` is never conversation.
    if text.startswith(INTERNAL_NOTE_PREFIX) or text.startswith("/"):
        return

    await relay.copy_to_client(client, message)
