import { NextResponse, type NextRequest } from 'next/server';
import { isBookableServiceId, isServiceId } from '@/content/services';
import { isTrainerSelection } from '@/content/trainers';
import { createBooking, isLiveBookingBackend } from '@/lib/booking';
import { listBookings } from '@/lib/mock/store';
import { isValidIsoDate, isValidTime, studioToday } from '@/lib/date';
import type { ApiError, BookingRequest } from '@/features/booking/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bookings?service=ems&date=2026-07-24
 *
 * Debug/demo listing of bookings in the in-memory mock. Not available against
 * the live backend: the public Altegio API can't list appointments (that needs
 * a business-user token), and exposing clients' contact details to an
 * unauthenticated caller would be wrong regardless.
 */
export function GET(request: NextRequest) {
  if (isLiveBookingBackend()) {
    return NextResponse.json<ApiError>(
      {
        error: 'Перелік записів недоступний.',
        code: 'not_supported',
      },
      { status: 501 },
    );
  }

  const params = request.nextUrl.searchParams;
  const service = params.get('service');
  const date = params.get('date');

  if (service && !isServiceId(service)) {
    return NextResponse.json<ApiError>(
      { error: 'Невідома послуга.', code: 'invalid_service' },
      { status: 400 },
    );
  }

  if (date && !isValidIsoDate(date)) {
    return NextResponse.json<ApiError>(
      { error: 'Дата має бути у форматі YYYY-MM-DD.', code: 'invalid_date' },
      { status: 400 },
    );
  }

  const bookings = listBookings({
    ...(service && isServiceId(service) ? { serviceId: service } : {}),
    ...(date ? { date } : {}),
  });

  // Contact details are stripped: the calendar only needs to know a slot is gone.
  return NextResponse.json({
    bookings: bookings.map(({ id, serviceId, date: on, time, createdAt }) => ({
      id,
      serviceId,
      date: on,
      time,
      createdAt,
    })),
  });
}

// A loose email check — enough to catch typos without rejecting valid addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(body: Partial<BookingRequest>): Record<string, string> {
  const fields: Record<string, string> = {};

  if (!body.serviceId || !isServiceId(body.serviceId)) {
    fields.serviceId = 'Оберіть послугу.';
  } else if (!isBookableServiceId(body.serviceId)) {
    // The widget greys these out; this stops a hand-crafted request too.
    fields.serviceId = 'Онлайн-запис на цю послугу тимчасово недоступний.';
  }

  if (!body.trainer || !isTrainerSelection(body.trainer)) {
    fields.trainer = 'Оберіть тренера.';
  }

  if (!body.date || !isValidIsoDate(body.date)) {
    fields.date = 'Оберіть дату.';
  } else if (body.date < studioToday()) {
    fields.date = 'Ця дата вже минула.';
  }

  if (!body.time || !isValidTime(body.time)) {
    fields.time = 'Оберіть час.';
  }

  const name = body.name?.trim() ?? '';
  if (name.length < 2) {
    fields.name = 'Вкажіть ім’я.';
  }

  // Ukrainian mobile numbers, tolerant of spaces, dashes and +38 prefixes.
  const phone = body.phone?.replace(/[\s()-]/g, '') ?? '';
  if (!/^(\+?38)?0\d{9}$/.test(phone)) {
    fields.phone = 'Вкажіть коректний номер телефону.';
  }

  // Email is optional, but if given it must look like an email.
  const email = body.email?.trim() ?? '';
  if (email && !EMAIL_RE.test(email)) {
    fields.email = 'Вкажіть коректну електронну пошту.';
  }

  return fields;
}

const STATUS_BY_CODE: Record<string, number> = {
  slot_taken: 409,
  no_staff: 409,
  invalid_phone: 422,
  provider_error: 502,
};

/**
 * POST /api/bookings
 *
 * Creates a booking through the provider (live Altegio or the mock). On the
 * live backend this is a real, non-cancellable appointment.
 */
export async function POST(request: NextRequest) {
  let body: Partial<BookingRequest>;

  try {
    body = (await request.json()) as Partial<BookingRequest>;
  } catch {
    return NextResponse.json<ApiError>(
      { error: 'Некоректний запит.', code: 'invalid_json' },
      { status: 400 },
    );
  }

  const fields = validate(body);
  if (Object.keys(fields).length > 0) {
    return NextResponse.json<ApiError>(
      { error: 'Перевірте заповнені поля.', code: 'validation_failed', fields },
      { status: 422 },
    );
  }

  // `validate` already proved each of these is present and well-formed; these
  // checks re-state that for the type system rather than reaching for `!`.
  const { serviceId, trainer, date, time, name, phone, email, comment } = body;
  if (
    !serviceId ||
    !isBookableServiceId(serviceId) ||
    !trainer ||
    !isTrainerSelection(trainer) ||
    !date ||
    !time ||
    !name ||
    !phone
  ) {
    return NextResponse.json<ApiError>(
      { error: 'Перевірте заповнені поля.', code: 'validation_failed' },
      { status: 422 },
    );
  }

  const result = await createBooking({
    serviceId,
    trainer,
    date,
    time,
    name: name.trim(),
    phone: phone.trim(),
    ...(email?.trim() ? { email: email.trim() } : {}),
    ...(comment?.trim() ? { comment: comment.trim() } : {}),
  });

  if (!result.ok) {
    return NextResponse.json<ApiError>(
      {
        error: result.message,
        code: result.code,
        ...(result.fields ? { fields: result.fields } : {}),
      },
      { status: STATUS_BY_CODE[result.code] ?? 502 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      booking: { serviceId, trainer, date: result.date, time: result.time },
    },
    { status: 201 },
  );
}
