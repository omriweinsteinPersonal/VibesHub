import { z } from 'zod';

export const idSchema = z.uuid();

export const moneySchema = z.object({
  amountMinor: z.int().nonnegative(),
  currency: z.literal('ILS'),
});

export const directionalTextSchema = z.object({
  direction: z.enum(['ltr', 'rtl']),
  language: z.enum(['en', 'he']),
  value: z.string().trim().min(1),
});

export const cursorPageSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    nextCursor: z.string().nullable(),
  });

export const problemDetailsSchema = z.object({
  type: z.string().default('about:blank'),
  title: z.string(),
  status: z.int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().optional(),
  requestId: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export const operationSchema = z.object({
  id: idSchema,
  status: z.enum(['accepted', 'processing', 'completed', 'failed']),
  resourceType: z.string(),
  resourceId: idSchema.optional(),
});

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
};
export type DirectionalText = z.infer<typeof directionalTextSchema>;
export type Money = z.infer<typeof moneySchema>;
export type Operation = z.infer<typeof operationSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
