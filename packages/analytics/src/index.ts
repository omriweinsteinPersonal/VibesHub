import { z } from 'zod';

export const clientAnalyticsEventNames = [
  'creator.storefrontViewed',
  'recommendation.impression',
  'story.opened',
  'story.completed',
  'discountCode.copied',
] as const;

const clientEventEnvelopeSchema = z.object({
  anonymousId: z.uuid(),
  eventId: z.uuid(),
  occurredAt: z.iso.datetime(),
  schemaVersion: z.literal(1),
  sessionId: z.uuid(),
  source: z.enum(['web', 'ios', 'android']),
});

export const clientAnalyticsEventSchema = z.discriminatedUnion('name', [
  clientEventEnvelopeSchema
    .extend({
      creatorId: z.uuid(),
      name: z.literal('creator.storefrontViewed'),
    })
    .strict(),
  clientEventEnvelopeSchema
    .extend({
      creatorId: z.uuid(),
      name: z.literal('recommendation.impression'),
      productId: z.uuid(),
      recommendationId: z.uuid(),
    })
    .strict(),
  clientEventEnvelopeSchema
    .extend({
      creatorId: z.uuid(),
      name: z.literal('story.opened'),
      productId: z.uuid(),
      recommendationId: z.uuid(),
    })
    .strict(),
  clientEventEnvelopeSchema
    .extend({
      creatorId: z.uuid(),
      durationMs: z
        .int()
        .positive()
        .max(15 * 60 * 1_000),
      name: z.literal('story.completed'),
      productId: z.uuid(),
      recommendationId: z.uuid(),
      watchedMs: z
        .int()
        .nonnegative()
        .max(15 * 60 * 1_000),
    })
    .strict()
    .refine((event) => event.watchedMs <= event.durationMs + 2_000, {
      message: 'Watched time cannot materially exceed video duration',
      path: ['watchedMs'],
    }),
  clientEventEnvelopeSchema
    .extend({
      creatorId: z.uuid(),
      discountCodeId: z.uuid(),
      name: z.literal('discountCode.copied'),
      recommendationId: z.uuid().nullable(),
    })
    .strict(),
]);

export const clientAnalyticsBatchSchema = z
  .object({
    batchId: z.uuid(),
    events: z.array(clientAnalyticsEventSchema).min(1).max(20),
  })
  .strict()
  .refine(
    ({ events }) => new Set(events.map(({ source }) => source)).size === 1,
    'Every event in a batch must have the same source',
  )
  .refine(
    ({ events }) => new Set(events.map(({ sessionId }) => sessionId)).size === 1,
    'Every event in a batch must have the same session',
  );

export const clientAnalyticsBatchResultSchema = z
  .object({
    accepted: z.int().nonnegative(),
    duplicates: z.int().nonnegative(),
    rejected: z.int().nonnegative(),
  })
  .strict();

export type ClientAnalyticsEvent = z.infer<typeof clientAnalyticsEventSchema>;
export type ClientAnalyticsBatch = z.infer<typeof clientAnalyticsBatchSchema>;
export type ClientAnalyticsBatchResult = z.infer<typeof clientAnalyticsBatchResultSchema>;
export type ClientAnalyticsEventName = (typeof clientAnalyticsEventNames)[number];
