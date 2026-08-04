"""The two keyboards the client ever sees."""

from __future__ import annotations

from aiogram.filters.callback_data import CallbackData
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

from .content import BOOKING_BUTTON, FORMATS


class BookFormat(CallbackData, prefix="book"):
    """Payload behind each format button."""

    format_id: str


def booking_keyboard() -> ReplyKeyboardMarkup:
    """The one button the client always has.

    ``is_persistent`` is what makes it survive the client tapping the collapse
    arrow — without it the single affordance this bot offers can be dismissed
    and never comes back on its own.
    """
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=BOOKING_BUTTON)]],
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Напишіть повідомлення…",
    )


def formats_keyboard() -> InlineKeyboardMarkup:
    """One format per row.

    Three side by side fit on a wide screen and truncate on a narrow one, and
    this is the only decision the client has to make — it can have the room.
    """
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text=fmt.button,
                    callback_data=BookFormat(format_id=fmt.id).pack(),
                )
            ]
            for fmt in FORMATS
        ]
    )
