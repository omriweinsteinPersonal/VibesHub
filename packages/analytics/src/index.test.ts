import { describe, expect, it } from 'vitest';

import { clientAnalyticsBatchSchema } from './index.js';

const firstSession = '018f47e2-1f6b-7d5a-b209-5f469f301234';
const secondSession = '018f47e2-1f6b-7d5a-b209-5f469f305678';

function storefrontEvent(sessionId = firstSession) {
  return {
    anonymousId: '018f47e2-1f6b-7d5a-b209-5f469f300001',
    creatorId: '018f47e2-1f6b-7d5a-b209-5f469f300002',
    eventId: crypto.randomUUID(),
    name: 'creator.storefrontViewed' as const,
    occurredAt: '2026-08-08T06:00:00.000Z',
    schemaVersion: 1 as const,
    sessionId,
    source: 'web' as const,
  };
}

describe('client analytics contracts', () => {
  it('accepts a strict storefront event batch', () => {
    expect(
      clientAnalyticsBatchSchema.parse({
        batchId: crypto.randomUUID(),
        events: [storefrontEvent()],
      }).events[0]?.name,
    ).toBe('creator.storefrontViewed');
  });

  it('rejects mixed sessions in a batch', () => {
    expect(() =>
      clientAnalyticsBatchSchema.parse({
        batchId: crypto.randomUUID(),
        events: [storefrontEvent(), storefrontEvent(secondSession)],
      }),
    ).toThrow(/same session/i);
  });

  it('rejects arbitrary event names and properties', () => {
    expect(() =>
      clientAnalyticsBatchSchema.parse({
        batchId: crypto.randomUUID(),
        events: [
          {
            ...storefrontEvent(),
            name: 'creator.secretViewed',
            rawEmail: 'shopper@example.com',
          },
        ],
      }),
    ).toThrow();
  });

  it('bounds story completion telemetry to the media duration', () => {
    const story = {
      ...storefrontEvent(),
      creatorId: '018f47e2-1f6b-7d5a-b209-5f469f300002',
      durationMs: 30_000,
      name: 'story.completed' as const,
      productId: '018f47e2-1f6b-7d5a-b209-5f469f300003',
      recommendationId: '018f47e2-1f6b-7d5a-b209-5f469f300004',
      watchedMs: 29_500,
    };
    expect(
      clientAnalyticsBatchSchema.parse({
        batchId: crypto.randomUUID(),
        events: [story],
      }).events[0]?.name,
    ).toBe('story.completed');
    expect(() =>
      clientAnalyticsBatchSchema.parse({
        batchId: crypto.randomUUID(),
        events: [{ ...story, watchedMs: 40_000 }],
      }),
    ).toThrow(/watched time/i);
  });
});
