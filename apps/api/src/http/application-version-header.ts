type RequestHeaders = Record<string, string | string[] | undefined>;

export function normalizeApplicationVersionHeader(headers: RequestHeaders): void {
  if (headers['if-match']) return;
  const applicationVersion = headers['x-swavii-if-match'];
  if (typeof applicationVersion === 'string' && applicationVersion.trim()) {
    headers['if-match'] = applicationVersion;
  }
}
