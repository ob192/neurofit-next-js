"""Entry point: `python -m app` from the `bot/` directory.

Long polling rather than a webhook. The studio has no public HTTPS endpoint of
its own, the website is a static deploy that should not grow a bot runtime, and
polling works unchanged on a laptop, a VPS and a container. If a webhook is ever
wanted, it is a change to this file alone.
"""

from __future__ import annotations

import asyncio
import logging
import sys

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ChatMemberStatus
from aiogram.exceptions import TelegramAPIError
from aiogram.types import BotCommand, BotCommandScopeChat

from . import version
from .analytics import Analytics
from .config import ConfigError, load_config
from .handlers import client as client_handlers
from .handlers import commands as command_handlers
from .handlers import setup as setup_handlers
from .handlers import studio as studio_handlers
from .relay import Relay
from .storage import open_store

log = logging.getLogger("app")

COMMANDS = [BotCommand(command="start", description="Записатись на тренування")]

#: Offered only inside the studio's group, so a client's command menu still
#: shows one entry and nobody is invited to mark their own lead as booked.
STUDIO_COMMANDS = [
    BotCommand(command="qualified", description="Лід якісний"),
    BotCommand(command="booked", description="Клієнт записався"),
    BotCommand(command="help", description="Команди в гілці клієнта"),
]


async def verify_group(bot: Bot, group_chat_id: int) -> None:
    """Fails fast if the group cannot carry the relay.

    Each check guards a setup mistake that would otherwise surface as the bot
    quietly ignoring customers — the most expensive way to find out.
    """
    try:
        chat = await bot.get_chat(group_chat_id)
    except TelegramAPIError as error:
        raise ConfigError(
            f"Cannot read the group {group_chat_id}: {error}. Check "
            "TELEGRAM_GROUP_CHAT_ID and that the bot is a member of that group."
        ) from error

    if not chat.is_forum:
        raise ConfigError(
            f"Group {group_chat_id} ({chat.title!r}) does not have Topics enabled. "
            "Turn on Topics in the group settings — the bot gives every client "
            "their own topic and cannot work without them."
        )

    me = await bot.get_me()
    member = await bot.get_chat_member(group_chat_id, me.id)

    # Administrator is not a nicety here, it is what makes the studio → client
    # direction work at all. Bots run with privacy mode on and only see commands
    # and replies addressed to them; an administrator bot receives every message
    # in the group. Without that, a manager types into a topic and the bot never
    # hears it.
    if member.status != ChatMemberStatus.ADMINISTRATOR:
        raise ConfigError(
            f"The bot is in {chat.title!r} as '{member.status}', not as an "
            "administrator. Promote it and grant 'Manage topics'. Administrator "
            "rights are also what let it read managers' replies — with privacy "
            "mode on, a non-admin bot never sees them."
        )

    if getattr(member, "can_manage_topics", None) is False:
        raise ConfigError(
            "The bot is an administrator but is not allowed to manage topics. "
            "Enable the 'Manage topics' permission — it opens a topic per client."
        )


async def run_setup_mode(bot: Bot) -> None:
    """Serves `/id` and nothing else, so the group id can be discovered.

    The id lives inside the group and this bot is the tool that reads it, so
    refusing to start without it would be a circle the studio cannot break.
    """
    log.warning(
        "TELEGRAM_GROUP_CHAT_ID is not set — running in setup mode. "
        "Add the bot to the studio group and send /id there, then put the "
        "number in bot/.env and restart."
    )
    dispatcher = Dispatcher()
    dispatcher.include_router(setup_handlers.router)
    await dispatcher.start_polling(
        bot, allowed_updates=dispatcher.resolve_used_update_types()
    )


async def run() -> None:
    config = load_config()

    bot = Bot(
        token=config.token,
        # No default parse mode: client-facing text is sent literally, and the
        # studio-facing messages that do use HTML ask for it explicitly.
        default=DefaultBotProperties(parse_mode=None),
    )

    analytics = Analytics(
        config.ga4_measurement_id,
        config.ga4_api_secret,
        debug=config.ga4_debug,
    )

    store = None
    try:
        if config.group_chat_id is None:
            await run_setup_mode(bot)
            return

        # Opened before the group checks so a bad database URL fails at startup
        # rather than the first time a client writes.
        store = await open_store(config.database_url, config.state_file)

        me = await bot.get_me()
        await verify_group(bot, config.group_chat_id)
        await bot.set_my_commands(COMMANDS)
        try:
            await bot.set_my_commands(
                STUDIO_COMMANDS, scope=BotCommandScopeChat(chat_id=config.group_chat_id)
            )
        except TelegramAPIError:
            # A convenience, not a requirement: the commands work whether or not
            # Telegram is willing to list them in the group's menu.
            log.warning("could not publish the studio commands to the group menu")

        # Applied here rather than in the module so the router cannot be wired
        # up without it: relaying an arbitrary group would forward strangers'
        # messages to the studio's clients.
        studio_handlers.router.message.filter(F.chat.id == config.group_chat_id)

        dispatcher = Dispatcher(
            relay=Relay(bot, store, config.group_chat_id, analytics)
        )
        # `/id` first: it is the only handler allowed to answer outside the
        # studio group, and the studio router would otherwise swallow it. The
        # managers' commands are here for the same reason — the studio router
        # ignores anything starting with `/`, so it must come last.
        dispatcher.include_router(setup_handlers.router)
        dispatcher.include_router(command_handlers.router)
        dispatcher.include_router(client_handlers.router)
        dispatcher.include_router(studio_handlers.router)

        log.info(
            "@%s v%s is listening; studio group %s; ga4 %s",
            me.username,
            version(),
            config.group_chat_id,
            "debug" if analytics.enabled and config.ga4_debug
            else "on" if analytics.enabled
            else "off",
        )
        await dispatcher.start_polling(
            bot, allowed_updates=dispatcher.resolve_used_update_types()
        )
    finally:
        await analytics.close()
        if store is not None:
            await store.close()
        await bot.session.close()


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )

    try:
        from dotenv import load_dotenv
    except ImportError:
        pass  # Production injects the environment; python-dotenv is dev-only.
    else:
        load_dotenv()

    try:
        asyncio.run(run())
    except ConfigError as error:
        log.error("%s", error)
        sys.exit(1)
    except KeyboardInterrupt:
        log.info("stopped")


if __name__ == "__main__":
    main()
