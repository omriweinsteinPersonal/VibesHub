import type { ClientAnalyticsEvent } from '@vibeshub/analytics';

import { getApiUrl } from './config';
import { randomUuid } from './random-id';

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

const anonymousStorageKey = 'swavii.analytics.anonymous.v2';
const legacyAnonymousStorageKey = 'vibeshub.analytics.anonymous.v1';
const sessionStorageKey = 'vibeshub.analytics.session.v1';
const analyticsOptOutStorageKey = 'swavii.analytics.opt-out.session.v1';

export function trackClientAnalytics(input: ClientEventInput): void {
  if (typeof window === 'undefined' || analyticsDisabled()) return;
  const event: ClientAnalyticsEvent = {
    ...input,
    anonymousId: getAnonymousIdentifier(),
    eventId: randomUuid(),
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    sessionId: getSessionIdentifier(sessionStorageKey),
    source: 'web',
  };

  void fetch(`${getApiUrl()}/v1/analytics/client-events`, {
    body: JSON.stringify({ batchId: randomUuid(), events: [event] }),
    headers: { 'content-type': 'application/json' },
    keepalive: true,
    method: 'POST',
  }).catch(() => {
    // Analytics must never block or interrupt the shopper journey.
  });
}

function getSessionIdentifier(key: string): string {
  const current = readStorage(window.sessionStorage, key);
  if (current) return current;
  const created = randomUuid();
  writeStorage(window.sessionStorage, key, created);
  return created;
}

function getAnonymousIdentifier(): string {
  const current = readStorage(window.localStorage, anonymousStorageKey);
  if (current) return current;

  const migrated = readStorage(window.sessionStorage, legacyAnonymousStorageKey);
  const created = migrated ?? randomUuid();
  writeStorage(window.localStorage, anonymousStorageKey, created);
  return created;
}

function analyticsDisabled(): boolean {
  if (navigator.webdriver) return true;

  const analyticsPreference = new URLSearchParams(window.location.search).get(
    'analytics',
  );
  if (analyticsPreference === 'off') {
    writeStorage(window.sessionStorage, analyticsOptOutStorageKey, '1');
    return true;
  }
  if (analyticsPreference === 'on') {
    removeStorage(window.sessionStorage, analyticsOptOutStorageKey);
    return false;
  }
  return readStorage(window.sessionStorage, analyticsOptOutStorageKey) === '1';
}

function readStorage(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Some privacy modes disable storage. Analytics should remain non-blocking.
  }
}

function removeStorage(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Some privacy modes disable storage. Analytics should remain non-blocking.
  }
}
