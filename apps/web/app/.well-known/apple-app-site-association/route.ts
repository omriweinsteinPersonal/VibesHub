import { NextResponse } from 'next/server';

import { createAppleAppSiteAssociation } from '../../../lib/app-links';

export function GET() {
  try {
    const payload = createAppleAppSiteAssociation(process.env.APPLE_TEAM_ID ?? '');
    return NextResponse.json(payload, {
      headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400' },
    });
  } catch (cause) {
    console.error('Apple app-site association is not configured', cause);
    return NextResponse.json({ error: 'App links are not configured.' }, { status: 503 });
  }
}
