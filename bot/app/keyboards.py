"""The two keyboards the client ever sees."""

from __future__ import annotations

from aiogram.filters.callback_data import CallbackData
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

from .content import BOOKING_BUTTON, FORMATS, INFO_BY_BUTTON


class BookFormat(CallbackData, prefix="book"):
    """Payload behind each format button."""

    format_id: str


def booking_keyboard() -> ReplyKeyboardMarkup:
    """The menu the client always has, under every message the bot sends.

    Booking sits alone on the top row — it is the one action, and pairing it
    with a question would make it just another option. The four info buttons
    follow, grouped so that the two long captions get a row each rather than
    being truncated side by side.

    ``is_persistent`` is what makes the keyboard survive the client tapping the
    collapse arrow; without it the whole menu can be dismissed and never comes
    back on its own.
    """
    labels = list(INFO_BY_BUTTON)
    rows = [[BOOKING_BUTTON]]
    if labels:
        # "Ціни" is short enough to share a row; the rest each take one.
        rows.append(labels[:2])
        rows.extend([label] for label in labels[2:])

    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=label) for label in row] for row in rows],
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
