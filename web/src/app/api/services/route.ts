import { NextResponse } from 'next/server';
import { services } from '@/content/services';

export const dynamic = 'force-dynamic';

/**
 * GET /api/services
 *
 * The service catalogue. Static content today, but exposed over the API so the
 * client has one consistent shape to consume.
 */
export function GET() {
  return NextResponse.json({
    services: services.map(({ id, name, shortName, durationMinutes }) => ({
      id,
      name,
      shortName,
      durationMinutes,
    })),
  });
}
