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


#: The booking button — the one that was here before the info buttons below.
BOOKING_BUTTON = "Записатися!"


@dataclass(frozen=True, slots=True)
class Part:
    """One message. Long answers are split into several."""

    #: Sent as HTML. Safe because these are constants with nothing interpolated
    #: into them — see `Relay.say`, which parses nothing by default.
    text: str


@dataclass(frozen=True, slots=True)
class InfoAnswer:
    """A question the studio is tired of answering by hand."""

    id: str
    button: str
    parts: tuple[Part, ...]
    #: Mirrors `drafted` in `web/src/content/faq.ts`: the wording was assembled
    #: from the site rather than dictated by the studio, and needs sign-off.
    #: Everything factual in a drafted answer is traceable to something already
    #: published on the site; nothing here was invented outright.
    drafted: bool = False


"""
The price list is duplicated from `web/src/content/pricing.ts`.

That is a real cost and it is taken deliberately: a client asking «Ціни» in a
chat wants the numbers in the chat, not a link, and the two halves of this
project do not share a language or a build. **Change one and you must change
the other.** The per-session figures below all divide exactly; if a package
stops dividing evenly, say so rather than rounding silently.

One message per service rather than one wall of text: in a chat a client is
choosing between formats, and a price list they have to scroll back through to
compare is the wrong shape for that.

Text only. These messages carried the service photo for a while; four pictures
arriving in a row read as noise rather than as help, and the studio asked for
them back out. The pictures still do their job on the website, where they are
looked at rather than scrolled past.
"""
PRICE_EMS = """<b>💰 EMS-тренування</b>

Разові заняття:
• Основне тренування — 650 грн
• Пробне тренування — 550 грн
• Лімфодренажний масаж — 450 грн (з EMS-тренуванням — бонусом)

Абонементи:
• 4 тренування — 2400 грн (600 грн / заняття, діє 30 днів)
• 8 тренувань — 4400 грн (550 грн / заняття, заморозка до 7 днів)
• 12 тренувань — 6000 грн (500 грн / заняття, заморозка до 10 днів) — найвигідніше, економія 23%"""

PRICE_STRETCHING = """<b>🤸 Стретчинг</b>

Разові заняття:
• Індивідуальне тренування — 500 грн
• Міні-група — 400 грн (до 5 осіб, ціна за особу)

Абонементи:
• 4 тренування — 1900 грн (475 грн / заняття)
• 8 тренувань — 3600 грн (450 грн / заняття)
• 10 тренувань — 4200 грн (420 грн / заняття) — економія 16%"""

PRICE_BOXING = """<b>🥊 EMS Бокс</b>

Бокс у поєднанні з EMS.

Разові заняття:
• Разове тренування — 600 грн

Абонементи:
• 4 тренування — 2300 грн (575 грн / заняття)
• 8 тренувань — 4400 грн (550 грн / заняття)
• 12 тренувань — 6000 грн (500 грн / заняття)"""

PRICE_ADDONS = """<b>✨ Додаткові послуги</b>

• Тюнінг преса — 250 грн (10 хв)
• Тюнінг сідниць — 250 грн (10 хв)"""

LOCATION = """<b>📍 Де ми знаходимось</b>

Проспект Перемоги, 119а, Чернігів
Щоденно 7:00 – 22:00
Телефон: 063 377 08 88

Google Maps: https://www.google.com/maps?cid=3364450468895833228
Як знайти вхід: https://www.instagram.com/p/DOGOCjzClqw/"""

DURATION = """<b>⏱ Скільки триває тренування</b>

EMS: саме тренування — <b>20 хвилин</b>, після нього лімфодренажний масаж — <b>10 хвилин</b> бонусом. Разом заняття триває 30 хвилин.

Стретчинг: заняття триває <b>1 годину</b>."""

# Scoped to EMS on the studio's instruction: the suit, the kit and the free
# massage are what an EMS session includes. Nothing is claimed about what a
# stretching session includes, because nobody has said.
INCLUDED = """<b>✅ Що входить у вартість</b>

EMS-тренування:
• Персональне заняття з тренером 1:1
• EMS-костюм і форма для тренування
• Лімфодренажний масаж — бонусом

Із собою потрібне лише змінне взуття."""

#: The info buttons, in the order they are drawn on the keyboard.
INFO_ANSWERS: tuple[InfoAnswer, ...] = (
    InfoAnswer(
        id="prices",
        button="Ціни",
        parts=(
            Part(PRICE_EMS),
            Part(PRICE_STRETCHING),
            Part(PRICE_BOXING),
            Part(PRICE_ADDONS),
        ),
    ),
    InfoAnswer(id="location", button="Де ми знаходимось?", parts=(Part(LOCATION),)),
    # The 20 + 10 split came from the studio directly. Note it contradicts the
    # website, which presents the whole 30 minutes as EMS — see the mismatch
    # recorded in docs/CURRENT_STATE.md.
    InfoAnswer(
        id="duration",
        button="Скільки триває тренування?",
        parts=(Part(DURATION),),
    ),
    InfoAnswer(
        id="included", button="Що входить у вартість?", parts=(Part(INCLUDED),)
    ),
)

INFO_BY_BUTTON: dict[str, InfoAnswer] = {a.button: a for a in INFO_ANSWERS}
INFO_BUTTONS: frozenset[str] = frozenset(INFO_BY_BUTTON)

#: Answers still awaiting the studio's sign-off. The counterpart of
#: `faqNeedsReview` in `web/src/content/faq.ts`.
INFO_NEEDS_REVIEW: tuple[InfoAnswer, ...] = tuple(a for a in INFO_ANSWERS if a.drafted)


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
    def asked(question: str) -> str:
        """Stands in for a canned answer in the topic.

        The answers are fixed and managers know them; mirroring the whole price
        list into a thread would bury the client's own words. What a manager
        needs from this line is the signal — *this* is what they wanted to know.
        """
        return f"ℹ️ Клієнт запитав: {question}"

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

    #: Marks the two commands a manager types into a client's topic. Both are
    #: answered in the thread, never sent to the client.
    QUALIFIED = "✅ Лід позначено як якісний"
    CONVERTED = "🎉 Клієнт записався на тренування"
    ALREADY_MARKED = "ℹ️ Ця позначка вже стоїть"
    NOT_A_CLIENT_TOPIC = (
        "Цю команду треба писати в гілці клієнта — тут немає кого позначати."
    )
    NO_ATTRIBUTION = (
        "ℹ️ Позначку збережено, але цей клієнт прийшов не з сайту — "
        "у статистику реклами вона не потрапить."
    )

    HELP = (
        "<b>Команди в гілці клієнта</b>\n"
        "<code>/qualified</code> — клієнт справді зацікавлений\n"
        "<code>/booked</code> — клієнт записався на тренування\n"
        "<code>//</code> на початку рядка — нотатка, клієнту не піде"
    )

    @staticmethod
    def attribution(
        *,
        source: str | None,
        medium: str | None,
        campaign: str | None,
        is_ads: bool,
    ) -> str | None:
        """Where this client came from, for the topic header.

        Only shown when the site actually knew — a blank line saying "невідомо"
        would be three lines of noise on top of every organic client, who are
        most of them.
        """
        parts = [value for value in (source, medium, campaign) if value]
        if not parts and not is_ads:
            return None
        label = " / ".join(parts) if parts else "Google Ads"
        return f"📣 Реклама: {label}" if is_ads else f"📣 Джерело: {label}"

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
