# NeuroFit booking bot

Takes training requests in Telegram and gives every client their own **topic**
in the studio's group chat. Managers answer from that topic; the client sees a
normal reply from the bot. Nobody hands out a personal number, and the whole
history of a client lives in one thread.

Python 3.11+ · [aiogram 3](https://docs.aiogram.dev) · long polling · Postgres for one small table.

The website (`../web/`) no longer books anything itself — every "Записатися"
CTA opens this bot. See [`../docs/TELEGRAM_BOOKING.md`](../docs/TELEGRAM_BOOKING.md).

## The flow

```
/start                      →  greeting + «Записатись на:» + [EMS] [EMS Бокс] [Стретчинг]
tap a format                →  «Зачекайте, наш менеджер з вами зв’яжеться 🙌»
                               and 🆕 Заявка lands in the client's topic
client writes anything      →  copied into their topic
manager writes in the topic →  copied to the client
```

The keyboard under every message is the menu:

```
[ Записатися! ]
[ Ціни ] [ Де ми знаходимось? ]
[ Скільки триває тренування? ]
[ Що входить у вартість? ]
```

**«Записатися!»** re-opens the format prompt. The four questions are answered by
the bot from canned text in `content.py` and are **not** forwarded to a manager
— the topic gets a one-line «Клієнт запитав: …» marker instead, so the studio
still sees what the client wanted without the price list burying the thread.

«Ціни» replies with **one message per service** rather than one wall of text:
a client is choosing between formats, and a list they have to scroll back
through to compare is the wrong shape for that. Text only — these messages
carried the service photo for a while, and four pictures in a row read as noise.

`/start ems`, `/start boxing`, `/start stretching` skip the prompt — those are
the deep links the website's per-service CTAs use, and the ids match
`web/src/content/services.ts`.

## Setup

1. **Create the bot** with [@BotFather](https://t.me/BotFather) and copy the
   token. (The studio's is `@neurofit_booking_bot`.)
2. **Create a group** for the studio and turn on **Topics** in its settings. A
   group without Topics cannot be used — the bot refuses to start.
3. **Add the bot to the group and make it an administrator** with the
   **Manage topics** permission.

   Administrator is not optional. Telegram bots run with privacy mode on and
   only receive commands and replies aimed at them; an administrator receives
   every message. Without it, managers would type into a topic and the bot
   would never see it.
4. **Get the group id.** Start the bot with `TELEGRAM_GROUP_CHAT_ID` empty — it
   comes up in *setup mode*, which answers exactly one command. Send `/id` in
   the group, copy the number, put it in `.env`, restart.
5. `cp .env.example .env` and fill both values.

## Run

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python -m app
```

Startup verifies the token, that the group is a forum, and that the bot is an
administrator that may manage topics. Every failure prints one line saying what
to fix.

### As a container

```bash
make build          # local image
make run            # runs it with bot/.env and a named volume for state
make login          # docker login as sasha192bunin
make tags           # what a deploy would publish
make deploy         # check, build, push → Docker Hub
make up / down / logs
```

### Versions and tags

The version lives in [`VERSION`](VERSION) and is what you deploy. Every deploy
publishes **three** tags:

| Tag | What it is |
| --- | --- |
| `0.1.0` | the version — **this is what you run**. Stable name; moves only when you rebuild that version on purpose. |
| `0.1.0-a10a373` | the exact build. Never reused, so "which build of 0.1.0 is this?" always has an answer. |
| `latest` | whatever was pushed last. A convenience, not a deploy target. |

Version first, then the build, because that is the order you reason in: pick a
version to run, then pin the build of it if you need to be precise.

```bash
make version                 # what is in VERSION
make tags                    # what a deploy would publish
make deploy                  # rebuild and republish the current version
make deploy VERSION=0.2.0    # release a new one — also writes it to VERSION
```

**Redeploying the same version is the normal case** — a copy fix, a rebuilt
base image — and re-running `make deploy` does exactly that: `0.1.0` moves to
the new build, and the build tag beside it records which one. Bump the version
when the studio should be able to talk about "the new one".

A build from an unclean tree gets `-dirty` in its build tag. The quick fix at
9pm is legitimate; it just must not masquerade as a commit.

The bot logs its build on startup, so the answer to "what is running?" is in
the logs rather than in an inspect of a tag that may since have moved:

```
@neurofit_booking_bot v0.1.0-a10a373 is listening; studio group -100…
```

The same values are on the image as OCI labels
(`org.opencontainers.image.version` and `.revision`).

Published as `sasha192bunin/neurofit-bot`, built for whatever architecture the
build machine is — so build on one matching the host you deploy to.

The token and group id are read at run time from `--env-file`, never baked into
the image. Leave `BOT_STATE_FILE` unset in `.env` when running the image: it
already points at `/data/state.json`, which is where the volume is mounted.

### As a service

```ini
# /etc/systemd/system/neurofit-bot.service
[Unit]
Description=NeuroFit booking bot
After=network-online.target

[Service]
WorkingDirectory=/srv/neurofit/bot
EnvironmentFile=/srv/neurofit/bot/.env
ExecStart=/srv/neurofit/bot/.venv/bin/python -m app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Only ever run **one** instance. Two processes polling the same token fight over
updates, and Telegram answers the loser with a 409.

## Layout

```
app/
├── __main__.py    entry point: config, startup checks, polling
├── analytics.py   GA4 Measurement Protocol — the conversions, sent server-side
├── config.py      environment, validated once
├── content.py     every string the bot sends — the studio edits this file
├── keyboards.py   the keyboard: booking + the four questions
├── relay.py       the two-way bridge; all Telegram calls for a client go here
├── storage.py     chat ↔ topic mapping, and the website's click log
└── handlers/
    ├── setup.py    /id — works before the group is configured
    ├── commands.py /qualified and /booked — must be registered before studio.py
    ├── client.py   the private chat
    └── studio.py   the group chat
```

`handlers/` describes the flow; `relay.py` owns the failure handling. That split
is why the handlers read like the list at the top of this file.

## What managers should know

- **Write in the client's topic** to answer them. Text, photos, voice — all of
  it is copied through.
- **A line starting with `//`** stays in the topic. Use it for internal notes.
- **Messages in *General*** go nowhere. Only client topics are relayed.
- **Closing a topic is safe.** If that client writes again the bot reopens the
  same thread, so the history stays in one place. Prefer closing to deleting.
- **Deleting a topic loses the conversation.** The next thing that client sends
  opens a fresh thread — the bot cannot recover a deleted one, because the Bot
  API has no way to look topics up.
- **`/qualified`** in a client's topic marks them a real prospect.
  **`/booked`** marks that they are coming to a session. Both are answered in
  the thread and never reach the client. `/help` lists them.

  These two are not paperwork. They are the only way the studio finds out which
  advertising actually produces clients: everything up to "opened the chat" can
  be measured automatically, and whether the person was serious is something
  only the manager talking to them knows. Each mark counts once — typing it
  twice says so instead of counting a second booking.

  A client who came in some other way — Telegram search, a friend, a business
  card — gets a note saying the mark was saved but there is no advertising to
  attribute it to. That is expected, not a fault.

- **A "📣 Реклама" line at the top of a topic** means that client arrived from a
  paid ad. Worth knowing before you answer them.

## State — and why it matters more than it looks

One row per client: chat id, topic id, name, the last format they asked for, the
website click they arrived from and the marks a manager has put on them. It is
the most valuable thing the bot owns.

The bot also owns the schema of `clicks`, the website's click log, though it
never writes to it — see [ANALYTICS.md](../docs/ANALYTICS.md). There is one
migration mechanism in this project and it is `storage.py`, so the table is
created here. **That means the bot deploys before the website**; a site pointed
at a database without the table falls back to plain deep links.

**The Bot API cannot list forum topics.** So if the bot forgets which topic
belongs to a client, it cannot look it up — it opens a *new* one, and the old
conversation is stranded in a thread nobody will read again. A lost mapping is
not a blank slate; it is a duplicated client.

Two backends:

- **`DATABASE_URL` set → Postgres.** What production uses. Survives a redeploy
  that forgets to mount a volume, and is shared rather than duplicated if a
  second instance ever starts. The table is created on first run; an existing
  JSON file is imported once, so switching over does not lose anyone.
- **Unset → `BOT_STATE_FILE`**, default `data/state.json`, written atomically.
  For tests and a laptop. In Docker this needs a volume at `/data` — and
  `BOT_STATE_FILE` must stay unset there so the image's own path wins.

### Topics are created in exactly two places

1. **No stored record for that chat id** — genuine first contact, *or* the
   mapping was lost.
2. **The stored topic will not take a message.** If it is *closed*, the bot
   reopens it. Only if it is really gone (`message thread not found`) does it
   open a new one.

If topics are multiplying, the cause is one of: a second instance running, the
mapping not persisting, or the studio deleting threads. In that order.

### Run exactly one instance

Two processes polling one token fight over `getUpdates`; Telegram answers the
loser with a 409 and splits updates unpredictably between them.

## Prices are duplicated

`content.py` carries the price list, and so does `web/src/content/pricing.ts`.
There is no shared source — the two halves of the project share neither a
language nor a build, and a client asking «Ціни» in a chat wants the numbers in
the chat rather than a link. **Change one and you must change the other.**

Every answer is currently signed off by the studio, so `INFO_NEEDS_REVIEW` is
empty. The `drafted` flag stays for the next answer that is assembled from the
site rather than dictated — it mirrors `faqNeedsReview` on the website, and an
answer carrying it should be treated as a question, not a fact.

## Deliberately absent

- **No calendar, no slots, no confirmation.** A manager agrees the time in
  chat. The bot never claims a booking exists.
- **No improvised answers.** The four buttons reply with fixed text the studio
  controls; everything a client *types* goes to a human. The bot never composes
  a reply about contraindications, availability or a price it wasn't given.
- **No schema beyond one table.** Postgres holds the client→topic mapping and
  nothing else — no message history, no CRM. The conversation lives in Telegram,
  which is already a better store for it than anything here would be.
- **No Altegio.** The integration still exists in the website repo, dormant —
  `web/src/archive/README.md` has the restore procedure.
