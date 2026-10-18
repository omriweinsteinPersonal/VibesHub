import { describe, expect, it } from 'vitest';

import { normalizeApplicationVersionHeader } from './application-version-header.js';

describe('application version header', () => {
  it('maps the private transport header to If-Match for controllers', () => {
    const headers = { 'x-swavii-if-match': '"7"' };

    normalizeApplicationVersionHeader(headers);

    expect(headers).toEqual({ 'if-match': '"7"', 'x-swavii-if-match': '"7"' });
  });

  it('does not replace a standard If-Match header outside Vercel', () => {
    const headers = { 'if-match': '"8"', 'x-swavii-if-match': '"7"' };

    normalizeApplicationVersionHeader(headers);

    expect(headers['if-match']).toBe('"8"');
  });
});
