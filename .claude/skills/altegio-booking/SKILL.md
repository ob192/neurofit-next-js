---
name: altegio-booking
description: Working with the Altegio (alteg.io) online-booking API — resolving a location, listing services/staff, checking availability, creating and validating bookings, and the management API for reading/cancelling appointments. Use when the task involves Altegio, alteg.io, book_services, book_record, or a b###.alteg.io booking widget.
---

# Altegio booking API

Two separate API surfaces, with different auth. Don't confuse them.

| Surface | Base | Auth | Can it write? |
|---|---|---|---|
| **Public booking API** (v1) | `https://api.alteg.io/api/v1` | `Bearer {partner_token}` only | Creates bookings, cannot cancel them |
| **B2B management API** (v2) | `https://api.alteg.io/api/v1/locations/{location_id}/...` | `Bearer {partner_token}, User {user_token}` | Full CRUD, incl. cancelling |

Every request needs:
```
Authorization: Bearer $ALTEGIO_PARTNER_TOKEN
Accept: application/vnd.api.v2+json
Content-Type: application/json   # POST/PUT only
```

Load the token from `.env` per-call, never hardcode or log it:
```bash
set -a; source .env; set +a
```

Rate limits: 200 req/min, 5 req/sec per IP. Cache services/staff where possible.

## Step 0 — resolve the location_id, and verify it's the *right* one

```bash
curl -s "https://api.alteg.io/api/v1/bookform/$ALTEGIO_FORM_ID" \
  -H "Authorization: Bearer $ALTEGIO_PARTNER_TOKEN" \
  -H "Accept: application/vnd.api.v2+json"
```
`data.company_id` is the `location_id` used in every call below.

**Gotcha (hit this in practice):** a booking-form ID can resolve to an
*empty* or *wrong* company — `book_services` returns `services: []` even
though the client's actual catalog, staff and schedule live under a
different `location_id`. If services/staff come back empty, don't assume
the location is simply unconfigured — cross-check against the location_id
visible in the admin timetable URL: `app.alteg.io/timetable/{location_id}`.
That's ground truth; the booking-form mapping can be stale or misconfigured.

## Step 1 — list services

```bash
curl -s "https://api.alteg.io/api/v1/book_services/$LOC" \
  -H "Authorization: Bearer $ALTEGIO_PARTNER_TOKEN" \
  -H "Accept: application/vnd.api.v2+json"
```
Each service has `id`, `title`, `price_min`/`price_max`, and `prepaid`
(`"forbidden"` | `"allowed"` | `"required"`). `prepaid: "required"` means
the public API can't complete checkout — hand off to the hosted widget
(`b{formId}.alteg.io`) or confirm the V2 payment flow with `api@alteg.io`.

**A service returning empty here despite existing in the admin** almost
always means: not toggled "available for online booking", OR toggled on
but not assigned to any staff member, OR assigned to staff with no
current/future work schedule. All three gates must be satisfied — check
`book_staff` (below) to see which one is missing.

## Step 2 — bookable staff for a service

```bash
curl -s "https://api.alteg.io/api/v1/book_staff/$LOC?service_ids%5B%5D=$SERVICE_ID" \
  -H "Authorization: Bearer $ALTEGIO_PARTNER_TOKEN" \
  -H "Accept: application/vnd.api.v2+json"
```
(`%5B%5D` is `[]` URL-encoded — required for the array query param.)
Use `staff_id=0` to mean "any". Check `bookable: true` and `schedule_till`
in the response — a staff member with `bookable: false` or a past
`schedule_till` date won't produce any dates in the next step even if
assigned to the service.

## Step 3 — available dates

```bash
curl -s "https://api.alteg.io/api/v1/book_dates/$LOC?staff_id=$STAFF_ID&service_ids%5B%5D=$SERVICE_ID" \
  -H "Authorization: Bearer $ALTEGIO_PARTNER_TOKEN" \
  -H "Accept: application/vnd.api.v2+json"
```
Returns `working_dates` (staff is on shift) and `booking_dates` (subset
that still has open slots — already excludes fully-booked days). Use
`booking_dates` to decide what's actually offerable.

## Step 4 — available times for a date (already excludes booked slots)

```bash
curl -s "https://api.alteg.io/api/v1/book_times/$LOC/$STAFF_ID/$DATE?service_ids%5B%5D=$SERVICE_ID" \
  -H "Authorization: Bearer $ALTEGIO_PARTNER_TOKEN" \
  -H "Accept: application/vnd.api.v2+json"
```
`$DATE` is `YYYY-MM-DD`. This is **the way to find already-booked slots**
from the public API: it does not list bookings directly — it returns only
the *remaining open* slots, with existing appointments already subtracted.
Each entry has `time` (`"HH:MM"`) and `datetime` (full ISO with offset,
e.g. `"2026-07-23T10:00:00+03:00"`). **Keep `datetime` verbatim** for the
next steps — don't reformat or reconstruct it.

To see the actual booked appointments (not just their absence from
`book_times`), you need the management API — see "Reading existing
appointments" below.

## Step 5 — check a privacy policy is required

```bash
curl -s "https://api.alteg.io/api/v1/privacy_policy/$LOC" \
  -H "Authorization: Bearer $ALTEGIO_PARTNER_TOKEN" \
  -H "Accept: application/vnd.api.v2+json"
```
If a policy exists, the flow must show it and require an acceptance
checkbox before `book_record`. Also check `phone_confirmation` in the
Step 0 `bookform` response — if `true`, an SMS step is required and its
`code` must be passed to `book_record`.

## Step 6 — validate without booking (`book_check`)

```bash
curl -s -X POST "https://api.alteg.io/api/v1/book_check/$LOC" \
  -H "Authorization: Bearer $ALTEGIO_PARTNER_TOKEN" \
  -H "Accept: application/vnd.api.v2+json" \
  -H "Content-Type: application/json" \
  -d '{"appointments":[{"id":1,"services":['"$SERVICE_ID"'],"staff_id":'"$STAFF_ID"',"datetime":"'"$DATETIME"'"}]}'
```
Success is an **empty 201** (`{"success":true,"data":null,...}`). Creates
nothing. Always prefer this over `book_record` while iterating.

## Step 7 — create a real appointment (`book_record`)

```bash
curl -s -X POST "https://api.alteg.io/api/v1/book_record/$LOC" \
  -H "Authorization: Bearer $ALTEGIO_PARTNER_TOKEN" \
  -H "Accept: application/vnd.api.v2+json" \
  -H "Content-Type: application/json" \
  -d '{
    "appointments":[{"id":1,"services":['"$SERVICE_ID"'],"staff_id":'"$STAFF_ID"',"datetime":"'"$DATETIME"'"}],
    "fullname":"...", "phone":"+380...", "email":"...", "comment":"..."
  }'
```
This is a **real, live appointment** — visible in the client's calendar
immediately, and may trigger SMS/email depending on location config.
Response: `[{"id":1,"record_id":..., "record_hash":"..."}]`. Treat this as
irreversible via the public API — see next section before creating one.

## ⚠️ There is no public "cancel booking" endpoint

Documentation and older references imply `record_id` + `record_hash` can
be used to delete a booking shortly after creating it. **In practice, as
of this API version, none of the following work from the public surface:**

```
DELETE /book_record/{loc}/{record_id}/{record_hash}   → 405 MethodNotAllowed
DELETE /book_record/{loc}/{record_id}                 → 405 MethodNotAllowed
DELETE /records/{loc}/{record_id}                      → 404 (legacy route, gone)
```

`book_record/{loc}/{record_id}/{record_hash}` only supports `GET` (read
details) and `PUT` (change date/time) — confirmed via `OPTIONS`, which
advertises `DELETE` in `access-control-allow-methods` (generic CORS
preflight) but the route itself rejects it with 405 regardless.

**Cancelling a live booking requires the B2B management API with a
business-user token** (`Bearer {partner_token}, User {user_token}`) —
which the partner token alone cannot authenticate as:

```
DELETE /locations/{location_id}/appointments/{appointment_id}
POST   /locations/{location_id}/timetable/appointments/delete   {"recordId": ...}
```

Both 404 with partner-only auth. There is no workaround from the public
API — cancellation must go through the admin UI (`app.alteg.io/timetable/
{location_id}`) or through a user token.

**Implication for testing:** don't create real bookings (`book_record`)
as a disposable test action expecting to clean up via API — assume you
cannot delete what you create. Use `book_check` for iteration instead,
and only call `book_record` when a live, kept appointment is actually the
intent (or you have a user token and a verified delete path ready first).

## Reading existing appointments (needs a user token)

The public API never lists bookings directly — only their *absence* from
`book_times`. To see actual appointment records, use the B2B v2
management API (`BearerPartnerUser` — partner token + user token):

```
GET /locations/{location_id}/appointments
    ?filter[date_intersect_from]=YYYY-MM-DDTHH:MM:SS
    &filter[date_intersect_to]=YYYY-MM-DDTHH:MM:SS
GET /locations/{location_id}/resource_occupations   # occupied resource/time intervals
```
Date filters have no timezone suffix and both bounds are required (end
after start). Response is JSON:API — `include=client`, `include=staff`,
`include=goods` for related data.

## Error codes (from `book_record` / `book_check`)

| HTTP | code | meaning |
|---|---|---|
| 422 | 431 | invalid phone format |
| 422 | 432 | bad SMS confirmation code |
| 422 | 433 | slot already taken (response includes conflicting appointment `id`) |
| 403 | 434 | phone is blacklisted |
| 422 | 435 | missing client name |
| 422 | 436 | no staff available (common with `staff_id: 0`) |
| 422 | 437 | overlapping times within the same request |
| — | 438 | service no longer available |

## Managing the service catalog (needs a user token)

Creating/editing services is **not** part of the public booking API —
`book_services` is read-only. It requires the B2B v2 management API
(`GET/POST /locations/{location_id}/services`, `BearerPartnerUser`
security), i.e. a user token on top of the partner token. Without one,
even `GET /locations/{location_id}/services` 404s. Catalog changes go
through the admin UI.

## Security

- Partner token lives only in `.env` (git-ignored). Never in `public/`,
  never echoed to logs/commits.
- Partner account ID (separate from any location_id) is Marketplace
  reference only — never sent in requests.
- User tokens (when obtained) are equally secret — same handling as the
  partner token, never in client-visible code.
