import { NextResponse, type NextRequest } from 'next/server';
import { isServiceId } from '@/content/services';
import { createBooking, listBookings } from '@/lib/mock/store';
import { isValidIsoDate, isValidTime, studioToday } from '@/lib/date';
import { SLOT_STEP_MINUTES } from '@/lib/mock/store';
import type { ApiError, BookingRequest } from '@/features/booking/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bookings?service=ems&date=2026-07-24
 *
 * Lists bookings held in the mock store. Both filters are optional.
 *
 * Note this is intentionally open in the mock — a real implementation must not
 * expose other clients' names and phone numbers to an unauthenticated caller.
 */
export function GET(request: NextRequest) {
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

function validate(body: Partial<BookingRequest>): Record<string, string> {
  const fields: Record<string, string> = {};

  if (!body.serviceId || !isServiceId(body.serviceId)) {
    fields.serviceId = 'Оберіть послугу.';
  }

  if (!body.date || !isValidIsoDate(body.date)) {
    fields.date = 'Оберіть дату.';
  } else if (body.date < studioToday()) {
    fields.date = 'Ця дата вже минула.';
  }

  if (!body.time || !isValidTime(body.time)) {
    fields.time = 'Оберіть час.';
  } else {
    const minutes = Number(body.time.slice(3));
    if (minutes % SLOT_STEP_MINUTES !== 0) {
      fields.time = `Час має бути кратним ${SLOT_STEP_MINUTES} хвилинам.`;
    }
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

  return fields;
}

/**
 * POST /api/bookings
 *
 * Records a booking in the in-memory store. On success the slot is immediately
 * unavailable to every subsequent availability query, which is what makes the
 * demo flow believable without a CRM behind it.
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
  const { serviceId, date, time, name, phone, comment } = body;
  if (
    !serviceId ||
    !isServiceId(serviceId) ||
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

  const booking = createBooking({
    serviceId,
    date,
    time,
    name: name.trim(),
    phone: phone.trim(),
    ...(comment?.trim() ? { comment: comment.trim() } : {}),
  });

  if (!booking) {
    return NextResponse.json<ApiError>(
      {
        error: 'Цей час щойно зайняли. Оберіть, будь ласка, інший.',
        code: 'slot_taken',
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      booking: {
        id: booking.id,
        serviceId: booking.serviceId,
        date: booking.date,
        time: booking.time,
        createdAt: booking.createdAt,
      },
    },
    { status: 201 },
  );
}
