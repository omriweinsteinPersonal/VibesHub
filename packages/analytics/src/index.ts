import { z } from 'zod';

export const analyticsEventNames = [
  'storefront_viewed',
  'creator_followed',
  'recommendation_saved',
  'product_clicked',
  'discount_code_copied',
  'video_started',
  'video_completed',
] as const;

export const analyticsEventSchema = z.object({
  eventId: z.uuid(),
  occurredAt: z.iso.datetime(),
  name: z.enum(analyticsEventNames),
  anonymousId: z.string().min(1).optional(),
  actorUserId: z.uuid().optional(),
  creatorId: z.uuid().optional(),
  recommendationId: z.uuid().optional(),
  sessionId: z.string().min(1),
  source: z.enum(['web', 'ios', 'android']),
});

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsEventName = (typeof analyticsEventNames)[number];
