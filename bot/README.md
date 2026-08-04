# NeuroFit booking bot

Takes training requests in Telegram and gives every client their own **topic**
in the studio's group chat. Managers answer from that topic; the client sees a
normal reply from the bot. Nobody hands out a personal number, and the whole
history of a client lives in one thread.

Python 3.11+ · [aiogram 3](https://docs.aiogram.dev) · long polling · no database.

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
[ Скільки триває EMS-тренування? ]
[ Що входить у вартість? ]
```

**«Записатися!»** re-opens the format prompt. The four questions are answered by
the bot from canned text in `content.py` and are **not** forwarded to a manager
— the topic gets a one-line «Клієнт запитав: …» marker instead, so the studio
still sees what the client wanted without the price list burying the thread. `/start ems`, `/start boxing`, `/start stretching` skip the
prompt — those are the deep links the website's per-service CTAs use, and the id
matches `web/src/content/services.ts`.

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

Every deploy publishes **two** tags: an immutable one and `latest`. The
immutable tag defaults to the short commit sha (`-dirty` appended if the tree
has uncommitted changes), so a container in production can always be traced
back to the code that built it — `latest` alone cannot, because it moves. The
same commit is recorded in the image's OCI labels:

```bash
docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
  sasha192bunin/neurofit-bot:latest
```

Override for a release name: `make deploy TAG=v1.2`. Pin the immutable tag in
production rather than `latest`, so a redeploy is a decision instead of a
side effect of whatever was pushed last.

Published as `sasha192bunin/neurofit-bot`, built for whatever architecture the
build machine is — so build on one matching the host you deploy to. The token and group id are read at
run time from `--env-file`, never baked into the image. Leave `BOT_STATE_FILE`
unset in `.env` when running the image — it already points at `/data/state.json`,
which is where the volume is mounted.

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
├── config.py      environment, validated once
├── content.py     every string the bot sends — the studio edits this file
├── keyboards.py   the persistent button and the three format buttons
├── relay.py       the two-way bridge; all Telegram calls for a client go here
├── storage.py     chat ↔ topic mapping, one JSON file
└── handlers/
    ├── setup.py   /id — works before the group is configured
    ├── client.py  the private chat
    └── studio.py  the group chat
```

`handlers/` describes the flow; `relay.py` owns the failure handling. That split
is why the handlers read like the list at the top of this file.

## What managers should know

- **Write in the client's topic** to answer them. Text, photos, voice — all of
  it is copied through.
- **A line starting with `//`** stays in the topic. Use it for internal notes.
- **Messages in *General*** go nowhere. Only client topics are relayed.
- **Deleting a topic doesn't delete the client.** The next thing they send
  re-opens one; the old conversation is gone, though, so prefer closing to
  deleting.

## State

`data/state.json` — or `/data/state.json` in the container — holds one row per
client: chat id, topic id, name, and the last format they asked for. Written
atomically. Override the path with `BOT_STATE_FILE`.

Losing it is recoverable but not free — the topics stay in the group, and the
next message from a known client opens a **second** topic for them. Back it up
with the rest of the host's data.

## Prices are duplicated

`content.py` carries the price list, and so does `web/src/content/pricing.ts`.
There is no shared source — the two halves of the project share neither a
language nor a build, and a client asking «Ціни» in a chat wants the numbers in
the chat rather than a link. **Change one and you must change the other.**

Two answers are marked `drafted=True` (`INFO_NEEDS_REVIEW`), mirroring
`faqNeedsReview` on the site: their wording was assembled from what the site
already publishes rather than dictated by the studio, and needs sign-off.

## Deliberately absent

- **No calendar, no slots, no confirmation.** A manager agrees the time in
  chat. The bot never claims a booking exists.
- **No improvised answers.** The four buttons reply with fixed text the studio
  controls; everything a client *types* goes to a human. The bot never composes
  a reply about contraindications, availability or a price it wasn't given.
- **No database.** See `storage.py` for why a file is the right size here.
- **No Altegio.** The integration still exists in the website repo, dormant —
  `web/src/archive/README.md` has the restore procedure.
