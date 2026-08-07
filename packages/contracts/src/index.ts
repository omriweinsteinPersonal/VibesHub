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

export const categoryCardSchema = z
  .object({
    descriptionHe: z.string().nullable(),
    id: idSchema,
    name: z.string().trim().min(1).max(100),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();

export const creatorCardSchema = z
  .object({
    bio: directionalTextSchema,
    displayName: z.string().trim().min(1).max(100),
    followerCount: z.int().nonnegative(),
    handle: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_-]{1,29}$/),
    id: idSchema,
    primaryCategory: categoryCardSchema.pick({ name: true, slug: true }),
    recommendationCount: z.int().nonnegative(),
    verificationStatus: z.enum(['unverified', 'verified']),
  })
  .strict();

const emptyStringToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export const creatorDirectoryQuerySchema = z
  .object({
    category: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(),
    ),
    cursor: z.preprocess(emptyStringToUndefined, z.string().trim().max(1_024).optional()),
    limit: z.coerce.number().int().min(1).max(48).default(12),
    q: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().toLowerCase().min(2).max(80).optional(),
    ),
  })
  .strict();

const optionalHttpsUrlSchema = z
  .url({ protocol: /^https$/ })
  .max(2_048)
  .nullable();
const optionalTrimmedStringSchema = (maximumLength: number) =>
  z.string().trim().min(1).max(maximumLength).nullable();

export const commercialRelationshipSchema = z.enum([
  'organic',
  'affiliate',
  'sponsored',
  'gifted',
]);

export const recommendationLifecycleSchema = z.enum(['draft', 'published', 'archived']);

export const hebrewRecommendationSchema = z
  .string()
  .trim()
  .min(1)
  .max(1_000)
  .refine((value) => /[א-ת]/u.test(value), 'A Hebrew recommendation is required');

export const recommendationImageContentTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const recommendationImageUploadInputSchema = z
  .object({
    contentType: recommendationImageContentTypeSchema,
    fileSizeBytes: z
      .int()
      .min(1)
      .max(5 * 1_024 * 1_024),
  })
  .strict();

export const recommendationImageUploadSchema = z
  .object({
    assetId: idSchema,
    bucket: z.literal('recommendation-image-uploads'),
    contentType: recommendationImageContentTypeSchema,
    expiresAt: z.iso.datetime(),
    objectPath: z.string().trim().min(1).max(512),
    token: z.string().trim().min(1),
  })
  .strict();

export const recommendationImageAssetSchema = z
  .object({
    contentType: recommendationImageContentTypeSchema,
    id: idSchema,
    publicUrl: z.url({ protocol: /^https$/ }).max(2_048),
    sizeBytes: z
      .int()
      .min(1)
      .max(5 * 1_024 * 1_024),
    status: z.literal('ready'),
  })
  .strict();

const creatorRecommendationInputFieldsSchema = z
  .object({
    brandName: z.string().trim().min(1).max(120),
    categoryId: idSchema,
    commercialRelationship: commercialRelationshipSchema.default('organic'),
    discountCode: optionalTrimmedStringSchema(50).optional(),
    discountLabel: optionalTrimmedStringSchema(100).optional(),
    imageAssetId: idSchema.nullable().optional(),
    imageUrl: optionalHttpsUrlSchema.optional(),
    priceAmountMinor: z.int().nonnegative(),
    productName: z.string().trim().min(1).max(200),
    productUrl: z.url({ protocol: /^https$/ }).max(2_048),
    reviewHe: hebrewRecommendationSchema,
    videoUrl: optionalHttpsUrlSchema.optional(),
  })
  .strict();

export const creatorRecommendationInputSchema =
  creatorRecommendationInputFieldsSchema.refine(
    (value) =>
      Number(Boolean(value.imageAssetId)) + Number(Boolean(value.imageUrl)) === 1,
    {
      message: 'Choose exactly one recommendation image source',
      path: ['imageAssetId'],
    },
  );

export const creatorRecommendationPatchSchema = creatorRecommendationInputFieldsSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one recommendation field is required',
  );

export const recommendationDiscountSchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    label: z.string().trim().min(1).max(100).nullable(),
  })
  .strict();

export const recommendationCardSchema = z
  .object({
    brandName: z.string().trim().min(1).max(120),
    category: categoryCardSchema.pick({ name: true, slug: true }),
    commercialRelationship: commercialRelationshipSchema,
    createdAt: z.iso.datetime(),
    discount: recommendationDiscountSchema.nullable(),
    id: idSchema,
    imageAssetId: idSchema.nullable(),
    imageUrl: z.url({ protocol: /^https$/ }).max(2_048),
    lifecycle: recommendationLifecycleSchema,
    merchantHostname: z.string().trim().min(4).max(253),
    price: moneySchema,
    productName: z.string().trim().min(1).max(200),
    review: directionalTextSchema,
    shopUrl: z
      .url()
      .max(2_048)
      .refine(isProductionOrLocalUrl, 'Use HTTPS outside local development'),
    updatedAt: z.iso.datetime(),
    version: z.int().positive(),
    videoUrl: optionalHttpsUrlSchema,
  })
  .strict();

export const creatorRecommendationSchema = recommendationCardSchema
  .extend({
    categoryId: idSchema,
    productUrl: z.url({ protocol: /^https$/ }).max(2_048),
  })
  .strict();

export const creatorStorefrontSchema = z
  .object({
    bio: directionalTextSchema,
    displayName: z.string().trim().min(1).max(100),
    followerCount: z.int().nonnegative(),
    handle: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_-]{1,29}$/),
    id: idSchema,
    primaryCategory: categoryCardSchema.pick({ name: true, slug: true }),
    recommendationCount: z.int().nonnegative(),
    verificationStatus: z.enum(['unverified', 'verified']),
  })
  .strict();

export const recommendationDirectoryQuerySchema = z
  .object({
    cursor: z.preprocess(emptyStringToUndefined, z.string().trim().max(1_024).optional()),
    limit: z.coerce.number().int().min(1).max(48).default(12),
  })
  .strict();

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

export const capabilitySchema = z.enum([
  'shopper:read',
  'shopper:save',
  'creator:manage_profile',
  'creator:manage_content',
  'creator:view_analytics',
  'moderator:review_content',
  'admin:manage_platform',
]);

export const accountProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
    interfaceLocale: z.enum(['en', 'he']),
    timezone: z.string().trim().min(1).max(100),
    version: z.int().positive(),
  })
  .strict();

export const accountProfilePatchSchema = accountProfileSchema
  .pick({ displayName: true, interfaceLocale: true, timezone: true })
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one profile field is required',
  );

export const socialPlatformSchema = z.enum(['instagram', 'tiktok', 'youtube', 'website']);

export const creatorApplicationSocialLinkSchema = z
  .object({
    followerCount: z.int().nonnegative().nullable().optional(),
    handle: z.string().trim().max(100).nullable().optional(),
    platform: socialPlatformSchema,
    url: z.url({ protocol: /^https$/ }).max(2_048),
  })
  .strict();

export const creatorApplicationStatusSchema = z.enum([
  'draft',
  'submitted',
  'under_review',
  'changes_requested',
  'approved',
  'rejected',
  'withdrawn',
]);

export const creatorApplicationInputSchema = z
  .object({
    bioText: z.string().trim().max(1_000).nullable().optional(),
    displayName: z.string().trim().min(1).max(100).nullable().optional(),
    primaryCategoryId: idSchema.nullable().optional(),
    requestedHandle: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9_-]{1,29}$/)
      .nullable()
      .optional(),
    socialLinks: z.array(creatorApplicationSocialLinkSchema).max(8).optional(),
  })
  .strict();

export const creatorApplicationPatchSchema = creatorApplicationInputSchema.refine(
  (value) => Object.keys(value).length > 0,
  'At least one application field is required',
);

export const creatorApplicationReviewInputSchema = z
  .object({
    privateNotes: z.string().trim().max(4_000).nullable().optional(),
    publicMessage: z.string().trim().max(2_000).nullable().optional(),
  })
  .strict();

export const idempotencyKeySchema = z.string().trim().min(8).max(200);

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
};
export type DirectionalText = z.infer<typeof directionalTextSchema>;
export type CategoryCard = z.infer<typeof categoryCardSchema>;
export type CreatorCard = z.infer<typeof creatorCardSchema>;
export type CreatorDirectoryQuery = z.infer<typeof creatorDirectoryQuerySchema>;
export type CommercialRelationship = z.infer<typeof commercialRelationshipSchema>;
export type CreatorRecommendationInput = z.infer<typeof creatorRecommendationInputSchema>;
export type CreatorRecommendationPatch = z.infer<typeof creatorRecommendationPatchSchema>;
export type CreatorRecommendation = z.infer<typeof creatorRecommendationSchema>;
export type CreatorStorefront = z.infer<typeof creatorStorefrontSchema>;
export type RecommendationCard = z.infer<typeof recommendationCardSchema>;
export type RecommendationDirectoryQuery = z.infer<
  typeof recommendationDirectoryQuerySchema
>;

function isProductionOrLocalUrl(value: string): boolean {
  const url = new URL(value);
  return (
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && ['127.0.0.1', '::1', 'localhost'].includes(url.hostname))
  );
}
export type RecommendationLifecycle = z.infer<typeof recommendationLifecycleSchema>;
export type RecommendationImageAsset = z.infer<typeof recommendationImageAssetSchema>;
export type RecommendationImageContentType = z.infer<
  typeof recommendationImageContentTypeSchema
>;
export type RecommendationImageUpload = z.infer<typeof recommendationImageUploadSchema>;
export type RecommendationImageUploadInput = z.infer<
  typeof recommendationImageUploadInputSchema
>;
export type AccountProfile = z.infer<typeof accountProfileSchema>;
export type AccountProfilePatch = z.infer<typeof accountProfilePatchSchema>;
export type Capability = z.infer<typeof capabilitySchema>;
export type CreatorApplicationInput = z.infer<typeof creatorApplicationInputSchema>;
export type CreatorApplicationPatch = z.infer<typeof creatorApplicationPatchSchema>;
export type CreatorApplicationReviewInput = z.infer<
  typeof creatorApplicationReviewInputSchema
>;
export type CreatorApplicationSocialLink = z.infer<
  typeof creatorApplicationSocialLinkSchema
>;
export type CreatorApplicationStatus = z.infer<typeof creatorApplicationStatusSchema>;
export type Money = z.infer<typeof moneySchema>;
export type Operation = z.infer<typeof operationSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
