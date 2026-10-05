import { NextResponse } from 'next/server';

import { createAndroidAssetLinks } from '../../../lib/app-links';

export function GET() {
  try {
    const payload = createAndroidAssetLinks(
      process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS ?? '',
    );
    return NextResponse.json(payload, {
      headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400' },
    });
  } catch (cause) {
    console.error('Android asset links are not configured', cause);
    return NextResponse.json({ error: 'App links are not configured.' }, { status: 503 });
  }
}
