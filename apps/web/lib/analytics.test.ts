import { afterEach, describe, expect, it, vi } from 'vitest';

import { trackClientAnalytics } from './analytics.js';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const creatorId = '01989f72-07e4-7f32-9b42-1ba55d4ca003';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('trackClientAnalytics', () => {
  it('keeps one anonymous visitor across browser sessions', () => {
    const localStorage = new MemoryStorage();
    const firstSession = new MemoryStorage();
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    stubBrowser(localStorage, firstSession, fetchMock);

    trackClientAnalytics({ creatorId, name: 'creator.storefrontViewed' });
    const firstEvent = submittedEvent(fetchMock, 0);

    const secondSession = new MemoryStorage();
    stubBrowser(localStorage, secondSession, fetchMock);
    trackClientAnalytics({ creatorId, name: 'creator.storefrontViewed' });
    const secondEvent = submittedEvent(fetchMock, 1);

    expect(secondEvent.anonymousId).toBe(firstEvent.anonymousId);
    expect(secondEvent.sessionId).not.toBe(firstEvent.sessionId);
  });

  it('does not submit analytics for automated or opted-out sessions', () => {
    const fetchMock = vi.fn();
    stubBrowser(new MemoryStorage(), new MemoryStorage(), fetchMock, '?analytics=off');

    trackClientAnalytics({ creatorId, name: 'creator.storefrontViewed' });
    expect(fetchMock).not.toHaveBeenCalled();

    stubBrowser(new MemoryStorage(), new MemoryStorage(), fetchMock, '', true);
    trackClientAnalytics({ creatorId, name: 'creator.storefrontViewed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function stubBrowser(
  localStorage: Storage,
  sessionStorage: Storage,
  fetchMock: ReturnType<typeof vi.fn>,
  search = '',
  webdriver = false,
) {
  vi.stubGlobal('window', {
    localStorage,
    location: { search },
    sessionStorage,
  });
  vi.stubGlobal('navigator', { webdriver });
  vi.stubGlobal('fetch', fetchMock);
}

function submittedEvent(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit;
  return (JSON.parse(String(init.body)) as { events: Array<Record<string, string>> })
    .events[0]!;
}
