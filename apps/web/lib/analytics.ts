import type { ClientAnalyticsEvent } from '@vibeshub/analytics';

import { getApiUrl } from './config';

type ClientEventInput = ClientAnalyticsEvent extends infer Event
  ? Event extends ClientAnalyticsEvent
    ? Omit<
        Event,
        | 'anonymousId'
        | 'eventId'
        | 'occurredAt'
        | 'schemaVersion'
        | 'sessionId'
        | 'source'
      >
    : never
  : never;

const anonymousStorageKey = 'vibeshub.analytics.anonymous.v1';
const sessionStorageKey = 'vibeshub.analytics.session.v1';

export function trackClientAnalytics(input: ClientEventInput): void {
  if (typeof window === 'undefined') return;
  const event: ClientAnalyticsEvent = {
    ...input,
    anonymousId: getSessionIdentifier(anonymousStorageKey),
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    sessionId: getSessionIdentifier(sessionStorageKey),
    source: 'web',
  } as ClientAnalyticsEvent;

  void fetch(`${getApiUrl()}/v1/analytics/client-events`, {
    body: JSON.stringify({ batchId: crypto.randomUUID(), events: [event] }),
    headers: { 'content-type': 'application/json' },
    keepalive: true,
    method: 'POST',
  }).catch(() => {
    // Analytics must never block or interrupt the shopper journey.
  });
}

function getSessionIdentifier(key: string): string {
  const current = window.sessionStorage.getItem(key);
  if (current) return current;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}
