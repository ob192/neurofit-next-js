"""Every string the bot ever sends, in one file.

Same rule as the website (``web/src/content/``): the studio must be able to
reword the bot without reading its logic, and a reviewer must be able to see the
whole customer-facing surface at a glance.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class Format:
    """A bookable training format."""

    #: Deliberately the same identifier the website uses in
    #: ``web/src/content/services.ts`` — the site's per-service CTAs pass it
    #: through as the ``/start`` deep-link payload. Changing one without the
    #: other silently downgrades those links to a generic "which format?" prompt.
    id: str
    #: Button caption.
    button: str
    #: Full name, as written to the studio.
    name: str


#: The three formats, in the order the buttons are drawn.
FORMATS: tuple[Format, ...] = (
    Format(id="ems", button="EMS", name="EMS-тренування"),
    Format(id="boxing", button="EMS Бокс", name="EMS Бокс"),
    Format(id="stretching", button="Стретчинг", name="Стретчинг"),
)

FORMATS_BY_ID: dict[str, Format] = {fmt.id: fmt for fmt in FORMATS}


def find_format(format_id: str) -> Format | None:
    return FORMATS_BY_ID.get(format_id.strip())


#: The one persistent keyboard button the client always has.
BOOKING_BUTTON = "Записатися!"


class messages:
    """Client-facing copy."""

    #: Sent once on ``/start``, and it is the message that installs the
    #: persistent keyboard — a reply keyboard and an inline keyboard cannot ride
    #: on the same message, so the booking prompt that follows carries the
    #: format buttons.
    GREETING = (
        "Вітаємо у NeuroFit! 💜\n\n"
        "Тут можна записатися на тренування — оберіть формат, "
        "і наш менеджер напише вам, щоб підтвердити зручний час."
    )

    #: The prompt above the three format buttons.
    BOOKING = "Записатись на:"

    #: Sent as soon as a format is chosen.
    WAIT_MANAGER = "Зачекайте, наш менеджер з вами зв’яжеться 🙌"

    #: Toast on the button press itself.
    CALLBACK_ACK = "Заявку прийнято"

    #: The prompt is stale — its buttons belong to a message we no longer track.
    CALLBACK_STALE = "Натисніть «Записатися!» ще раз"

    #: Anything the client sends outside the booking flow is relayed to the
    #: studio, so the only honest reply is that a human will read it.
    MESSAGE_FORWARDED = "Дякуємо! Ваше повідомлення передано менеджеру."

    #: Shown when the studio's group is misconfigured and nothing can be relayed.
    RELAY_UNAVAILABLE = (
        "Вибачте, зараз не вдається передати заявку. "
        "Зателефонуйте, будь ласка, за номером 063 377 08 88."
    )

    @staticmethod
    def format_chosen(name: str) -> str:
        return f"Ваш вибір: {name}"

    @staticmethod
    def booking_answered(name: str) -> str:
        """Replaces the prompt once a button is pressed, so it can't be tapped twice."""
        return f"Записатись на: {name} ✅"


class studio:
    """Copy for the studio side — the group chat.

    Managers read this all day, so it is terse and prefixed with a symbol they
    can scan for. Everything here is rendered as HTML; callers escape the values
    they interpolate.
    """

    STARTED = "ℹ️ Клієнт відкрив бота"
    TAPPED_BOOKING_BUTTON = "ℹ️ Клієнт натиснув «Записатися!»"

    @staticmethod
    def topic_name(name: str, username: str | None) -> str:
        title = f"{name} · @{username}" if username else name
        # Telegram rejects topic names longer than 128 characters.
        return title[:128] or "Клієнт"

    @staticmethod
    def client_header(
        *, name: str, chat_id: int, username: str | None, source: str | None
    ) -> str:
        lines = [
            f"👤 <b>{name}</b>",
            f"Telegram: @{username}" if username else "Telegram: без юзернейму",
            f"ID: <code>{chat_id}</code>",
        ]
        if source:
            lines.append(f"Прийшов з: {source}")
        lines += [
            "",
            "Пишіть у цю гілку — клієнт отримає повідомлення від бота.",
            "Рядок, що починається з <code>//</code>, залишиться тут "
            "і клієнту не піде.",
        ]
        return "\n".join(lines)

    @staticmethod
    def requested(format_name: str) -> str:
        return f"🆕 <b>Заявка: {format_name}</b>"

    @staticmethod
    def bot_said(text: str) -> str:
        """Echo of what the bot said to the client, so the topic is a full record."""
        return f"🤖 {text}"

    @staticmethod
    def delivery_failed(reason: str) -> str:
        return f"⚠️ Не вдалося доставити повідомлення клієнту: {reason}"

    @staticmethod
    def chat_id(chat_id: int, thread_id: int | None) -> str:
        """Reply to ``/id`` — the quickest way to read the group's chat id."""
        lines = [f"<code>{chat_id}</code>"]
        if thread_id is not None:
            lines.append(f"гілка: <code>{thread_id}</code>")
        lines += ["", "Це значення для <code>TELEGRAM_GROUP_CHAT_ID</code>."]
        return "\n".join(lines)
