"""GA4 Measurement Protocol — the bot's half of the conversion tracking.

Booking left the website for this chat, and took the conversion with it. Three
of the four stages of a lead now happen where no browser can see them: the
client asking for a format, a manager judging it real, and a manager confirming
the appointment. This module is how those reach GA4.

The website sends the first stage from its redirect handler
(`web/src/app/go/tg/route.ts`) and the two share a contract that is worth
stating once:

* **`client_id` is the visitor's, not ours.** It was read from GA4's own cookie
  at the moment of the click and stored on the click row. Inventing one here
  would file every booking as a new user arriving from nowhere — the count
  would be right and every other column would be wrong.
* **`session_id` is only sent with an event that happened during that visit.**
  The click did. A manager typing ``/qualified`` on Thursday about a click from
  Tuesday did not, and claiming otherwise tells GA4 a two-day session is still
  running. Sent without one, GA4 attributes the conversion to that user's
  earlier campaign touchpoint using its own model — which is the question being
  asked.
* **Nothing that identifies a person is sent.** No name, no username, no
  Telegram id, no message. Google's terms forbid it, and the studio's own
  record of who this is lives in Telegram where it belongs.

Every call is best-effort. A booking must never fail because Google did.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

log = logging.getLogger(__name__)

ENDPOINT = "https://www.google-analytics.com/mp/collect"
#: Same payload, but it answers with validation errors instead of a silent 204.
DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect"

#: Long enough for a round trip, short enough that a manager's ``/qualified``
#: never feels like it hung.
TIMEOUT_SECONDS = 5


class Analytics:
    """Sends events, or does nothing at all.

    Unconfigured is a first-class state, not a degraded one: the bot runs on a
    laptop and in tests without credentials, and the alternative — a required
    variable — would mean a studio that mistyped a secret has a bot that will
    not start.
    """

    def __init__(self, measurement_id: str | None, api_secret: str | None,
                 *, debug: bool = False) -> None:
        self._measurement_id = measurement_id
        self._api_secret = api_secret
        self._debug = debug
        self._session: Any = None

    @property
    def enabled(self) -> bool:
        return bool(self._measurement_id and self._api_secret)

    async def send(
        self,
        name: str,
        *,
        client_id: str | None,
        session_id: str | None = None,
        params: dict[str, Any] | None = None,
    ) -> None:
        """Sends one event. Never raises, never blocks a reply for long.

        ``client_id`` of ``None`` means this client reached the bot without a
        website click — Telegram search, a business card, a friend forwarding
        the handle. There is no visitor to attach the event to, so nothing is
        sent rather than a fabricated user being invented to hold it.
        """
        if not self.enabled or not client_id:
            return

        payload = {
            "client_id": client_id,
            # GA4 discards anything older than 72 hours. This is the time the
            # event happened, never the time of the click it descends from.
            "timestamp_micros": int(time.time() * 1_000_000),
            "events": [
                {
                    "name": name,
                    "params": {
                        **(params or {}),
                        # Without a non-zero engagement time the event is
                        # collected but missing from most standard reports.
                        "engagement_time_msec": 1,
                        **({"session_id": session_id} if session_id else {}),
                    },
                }
            ],
        }

        try:
            await asyncio.wait_for(self._post(payload, name), TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            log.warning("ga4: %s timed out", name)
        except Exception:  # noqa: BLE001 — analytics never breaks a booking.
            log.exception("ga4: %s failed", name)

    async def _post(self, payload: dict[str, Any], name: str) -> None:
        # aiohttp arrives with aiogram, so this costs no new dependency. Imported
        # here rather than at module scope so an unconfigured bot never touches
        # it at all.
        import aiohttp

        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()

        url = DEBUG_ENDPOINT if self._debug else ENDPOINT
        async with self._session.post(
            url,
            params={
                "measurement_id": self._measurement_id or "",
                "api_secret": self._api_secret or "",
            },
            json=payload,
        ) as response:
            if self._debug:
                # The live endpoint returns 204 for a malformed payload exactly
                # as it does for a good one, so this is the only way to find out
                # whether anything was actually accepted.
                log.info("ga4: %s → %s", name, await response.text())
            elif response.status >= 400:
                log.warning("ga4: %s → HTTP %s", name, response.status)

    async def close(self) -> None:
        if self._session is not None and not self._session.closed:
            await self._session.close()
