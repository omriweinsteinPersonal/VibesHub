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
    avatarUrl: z
      .url({ protocol: /^https$/ })
      .max(2_048)
      .nullable(),
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

export const creatorRecommendationMoveInputSchema = z
  .object({
    direction: z.enum(['up', 'down']),
  })
  .strict();

export const recommendationDiscountSchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    expiresAt: z.iso.datetime().nullable().optional(),
    id: idSchema.nullable(),
    label: z.string().trim().min(1).max(100).nullable(),
    lastVerifiedAt: z.iso.datetime().nullable().optional(),
    verificationStatus: z
      .enum([
        'unverified',
        'creator_confirmed',
        'staff_confirmed',
        'merchant_verified',
        'failed',
        'stale',
      ])
      .optional(),
  })
  .strict();

export const creatorAnalyticsMetricSchema = z
  .object({
    codeCopies: z.int().nonnegative(),
    recommendationViews: z.int().nonnegative(),
    shopClicks: z.int().nonnegative(),
    storyCompletions: z.int().nonnegative(),
    storyOpens: z.int().nonnegative(),
    storefrontViews: z.int().nonnegative(),
    uniqueVisitors: z.int().nonnegative(),
  })
  .strict();

export const creatorAnalyticsDashboardSchema = z
  .object({
    range: z
      .object({
        days: z.int().min(7).max(90),
        from: z.iso.date(),
        to: z.iso.date(),
      })
      .strict(),
    recommendations: z.array(
      z
        .object({
          codeCopies: z.int().nonnegative(),
          id: idSchema,
          productName: z.string().trim().min(1).max(200),
          shopClicks: z.int().nonnegative(),
          storyCompletions: z.int().nonnegative(),
          storyOpens: z.int().nonnegative(),
          views: z.int().nonnegative(),
        })
        .strict(),
    ),
    series: z.array(creatorAnalyticsMetricSchema.extend({ date: z.iso.date() }).strict()),
    summary: creatorAnalyticsMetricSchema,
  })
  .strict();

export const discountCodeVerificationStatusSchema = z.enum([
  'unverified',
  'creator_confirmed',
  'staff_confirmed',
  'merchant_verified',
  'failed',
  'stale',
]);

export const discountCodeLifecycleSchema = z.enum([
  'draft',
  'submitted',
  'published',
  'hidden',
  'expired',
  'archived',
]);

const discountCodeInputFieldsSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^\S+$/, 'Discount codes cannot contain spaces')
      .transform((value) => value.toUpperCase()),
    detailsHe: z
      .string()
      .trim()
      .min(1)
      .max(1_000)
      .refine((value) => /[א-ת]/u.test(value), 'Hebrew details are required')
      .nullable(),
    expiresAt: z.iso.datetime().nullable(),
    label: z.string().trim().min(1).max(100).nullable(),
    merchantUrl: z.url({ protocol: /^https$/ }).max(2_048),
    startsAt: z.iso.datetime().nullable(),
  })
  .strict();

function validDiscountWindow(value: {
  expiresAt?: string | null | undefined;
  startsAt?: string | null | undefined;
}) {
  return !value.expiresAt || !value.startsAt || value.expiresAt > value.startsAt;
}

export const creatorDiscountCodeInputSchema = discountCodeInputFieldsSchema.refine(
  validDiscountWindow,
  {
    message: 'Expiration must be after the start date',
    path: ['expiresAt'],
  },
);

export const creatorDiscountCodePatchSchema = discountCodeInputFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required')
  .refine(validDiscountWindow, {
    message: 'Expiration must be after the start date',
    path: ['expiresAt'],
  });

export const publicDiscountCodeSchema = z
  .object({
    code: z.string().trim().min(1).max(50),
    details: directionalTextSchema.nullable(),
    expiresAt: z.iso.datetime().nullable(),
    id: idSchema,
    label: z.string().trim().min(1).max(100).nullable(),
    lastVerifiedAt: z.iso.datetime().nullable(),
    merchantHostname: z.string().trim().min(4).max(253),
    merchantName: z.string().trim().min(1).max(160),
    startsAt: z.iso.datetime().nullable(),
    verificationStatus: discountCodeVerificationStatusSchema,
  })
  .strict();

export const creatorDiscountCodeSchema = publicDiscountCodeSchema
  .extend({
    lifecycle: discountCodeLifecycleSchema,
    merchantUrl: z.url({ protocol: /^https$/ }).max(2_048),
    updatedAt: z.iso.datetime(),
    version: z.int().positive(),
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
    productId: idSchema,
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
    position: z.int().nonnegative(),
    productUrl: z.url({ protocol: /^https$/ }).max(2_048),
  })
  .strict();

export const creatorStorefrontSchema = z
  .object({
    avatarUrl: z
      .url({ protocol: /^https$/ })
      .max(2_048)
      .nullable(),
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
    socialLinks: z.array(
      z
        .object({
          handle: z.string().trim().max(100).nullable(),
          platform: z.enum(['instagram', 'tiktok', 'youtube', 'website']),
          url: z.url({ protocol: /^https$/ }).max(2_048),
        })
        .strict(),
    ),
    verificationStatus: z.enum(['unverified', 'verified']),
  })
  .strict();

export const recommendationDirectoryQuerySchema = z
  .object({
    cursor: z.preprocess(emptyStringToUndefined, z.string().trim().max(1_024).optional()),
    limit: z.coerce.number().int().min(1).max(48).default(12),
  })
  .strict();

export const discoverySortSchema = z.enum(['trending', 'most-saved', 'newest']);

export const discoveryRecommendationQuerySchema = z
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
    limit: z.coerce.number().int().min(1).max(48).default(24),
    q: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().toLowerCase().min(2).max(80).optional(),
    ),
    sort: discoverySortSchema.default('trending'),
  })
  .strict();

export const globalSearchQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(8).default(5),
    q: z.string().trim().toLowerCase().min(2).max(80),
  })
  .strict();

export const recommendationCreatorSchema = creatorCardSchema
  .pick({ displayName: true, handle: true, id: true, verificationStatus: true })
  .strict();

export const discoveryRecommendationCardSchema = recommendationCardSchema
  .extend({
    creator: recommendationCreatorSchema,
    savedCount: z.int().nonnegative(),
  })
  .strict();

export const globalSearchResultsSchema = z
  .object({
    creators: z.array(creatorCardSchema),
    products: z.array(discoveryRecommendationCardSchema),
  })
  .strict();

export const engagementListQuerySchema = z
  .object({
    cursor: z.preprocess(emptyStringToUndefined, z.string().trim().max(1_024).optional()),
    limit: z.coerce.number().int().min(1).max(48).default(24),
  })
  .strict();

export const engagementStateInputSchema = z
  .object({
    creatorIds: z.array(idSchema).max(48).default([]),
    productIds: z.array(idSchema).max(48).default([]),
  })
  .strict()
  .refine((value) => value.creatorIds.length > 0 || value.productIds.length > 0, {
    message: 'At least one creator or product is required',
  });

export const engagementStateSchema = z
  .object({
    followedCreatorIds: z.array(idSchema),
    savedProductIds: z.array(idSchema),
  })
  .strict();

export const saveProductInputSchema = z
  .object({
    sourceRecommendationId: idSchema.nullable().optional(),
  })
  .strict();

export const savedProductSchema = z
  .object({
    productId: idSchema,
    recommendation: recommendationCardSchema,
    savedAt: z.iso.datetime(),
  })
  .strict();

export const followedCreatorSchema = z
  .object({
    creator: creatorCardSchema,
    followedAt: z.iso.datetime(),
  })
  .strict();

export const merchantDomainReviewStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'disabled',
]);

export const merchantDomainQueueQuerySchema = z
  .object({
    cursor: z.preprocess(emptyStringToUndefined, z.string().trim().max(1_024).optional()),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    status: merchantDomainReviewStatusSchema.default('pending'),
  })
  .strict();

export const merchantDomainApprovalInputSchema = z
  .object({
    allowImport: z.boolean().default(false),
    allowRedirect: z.boolean().default(true),
    note: z.string().trim().min(1).max(2_000).nullable().optional(),
  })
  .strict()
  .refine((value) => value.allowImport || value.allowRedirect, {
    message: 'Approve at least one merchant-domain permission',
    path: ['allowRedirect'],
  });

export const merchantDomainReasonInputSchema = z
  .object({
    note: z.string().trim().min(1).max(2_000),
  })
  .strict();

export const merchantDomainReviewItemSchema = z
  .object({
    allowImport: z.boolean(),
    allowRedirect: z.boolean(),
    createdAt: z.iso.datetime(),
    creatorCount: z.int().nonnegative(),
    hostname: z.string().trim().min(4).max(253),
    id: idSchema,
    latestRecommendationAt: z.iso.datetime().nullable(),
    merchant: z
      .object({
        homepageUrl: z.url({ protocol: /^https$/ }).max(2_048),
        id: idSchema,
        name: z.string().trim().min(1).max(160),
        status: z.enum(['active', 'inactive']),
      })
      .strict(),
    recommendationCount: z.int().nonnegative(),
    reviewedAt: z.iso.datetime().nullable(),
    reviewedByUserId: idSchema.nullable(),
    reviewNote: z.string().trim().min(1).max(2_000).nullable(),
    reviewStatus: merchantDomainReviewStatusSchema,
    updatedAt: z.iso.datetime(),
    verifiedAt: z.iso.datetime().nullable(),
    version: z.int().positive(),
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

export const creatorProfileSocialLinkSchema = z
  .object({
    handle: z.string().trim().min(1).max(100).nullable().optional(),
    platform: socialPlatformSchema,
    url: z.url({ protocol: /^https$/ }).max(2_048),
  })
  .strict();

export const creatorProfileSettingsSchema = z
  .object({
    avatar: z
      .object({
        assetId: idSchema,
        url: z.url({ protocol: /^https$/ }).max(2_048),
      })
      .strict()
      .nullable(),
    bioHe: z.string().trim().min(1).max(1_000),
    displayName: z.string().trim().min(1).max(100),
    handle: creatorCardSchema.shape.handle,
    id: idSchema,
    primaryCategory: categoryCardSchema.pick({ id: true, name: true, slug: true }),
    socialLinks: z.array(creatorProfileSocialLinkSchema).max(4),
    version: z.int().positive(),
  })
  .strict();

export const creatorProfilePatchSchema = z
  .object({
    avatarAssetId: idSchema.nullable().optional(),
    bioHe: z
      .string()
      .trim()
      .min(1)
      .max(1_000)
      .refine((value) => /[א-ת]/u.test(value), 'A Hebrew creator bio is required')
      .optional(),
    displayName: z.string().trim().min(1).max(100).optional(),
    primaryCategoryId: idSchema.optional(),
    socialLinks: z
      .array(creatorProfileSocialLinkSchema)
      .max(4)
      .refine(
        (links) => new Set(links.map(({ platform }) => platform)).size === links.length,
        'Use each social platform at most once',
      )
      .optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one profile field is required',
  );

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
export type CreatorRecommendationMoveInput = z.infer<
  typeof creatorRecommendationMoveInputSchema
>;
export type CreatorRecommendation = z.infer<typeof creatorRecommendationSchema>;
export type CreatorDiscountCodeInput = z.infer<typeof creatorDiscountCodeInputSchema>;
export type CreatorDiscountCodePatch = z.infer<typeof creatorDiscountCodePatchSchema>;
export type CreatorDiscountCode = z.infer<typeof creatorDiscountCodeSchema>;
export type PublicDiscountCode = z.infer<typeof publicDiscountCodeSchema>;
export type CreatorAnalyticsDashboard = z.infer<typeof creatorAnalyticsDashboardSchema>;
export type DiscountCodeLifecycle = z.infer<typeof discountCodeLifecycleSchema>;
export type DiscountCodeVerificationStatus = z.infer<
  typeof discountCodeVerificationStatusSchema
>;
export type CreatorStorefront = z.infer<typeof creatorStorefrontSchema>;
export type RecommendationCard = z.infer<typeof recommendationCardSchema>;
export type RecommendationDirectoryQuery = z.infer<
  typeof recommendationDirectoryQuerySchema
>;
export type DiscoverySort = z.infer<typeof discoverySortSchema>;
export type DiscoveryRecommendationQuery = z.infer<
  typeof discoveryRecommendationQuerySchema
>;
export type DiscoveryRecommendationCard = z.infer<
  typeof discoveryRecommendationCardSchema
>;
export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;
export type GlobalSearchResults = z.infer<typeof globalSearchResultsSchema>;
export type RecommendationCreator = z.infer<typeof recommendationCreatorSchema>;
export type EngagementListQuery = z.infer<typeof engagementListQuerySchema>;
export type EngagementStateInput = z.infer<typeof engagementStateInputSchema>;
export type EngagementState = z.infer<typeof engagementStateSchema>;
export type SaveProductInput = z.infer<typeof saveProductInputSchema>;
export type SavedProduct = z.infer<typeof savedProductSchema>;
export type FollowedCreator = z.infer<typeof followedCreatorSchema>;
export type MerchantDomainApprovalInput = z.infer<
  typeof merchantDomainApprovalInputSchema
>;
export type MerchantDomainQueueQuery = z.infer<typeof merchantDomainQueueQuerySchema>;
export type MerchantDomainReasonInput = z.infer<typeof merchantDomainReasonInputSchema>;
export type MerchantDomainReviewItem = z.infer<typeof merchantDomainReviewItemSchema>;
export type MerchantDomainReviewStatus = z.infer<typeof merchantDomainReviewStatusSchema>;

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
export type CreatorProfilePatch = z.infer<typeof creatorProfilePatchSchema>;
export type CreatorProfileSettings = z.infer<typeof creatorProfileSettingsSchema>;
export type CreatorProfileSocialLink = z.infer<typeof creatorProfileSocialLinkSchema>;
export type Money = z.infer<typeof moneySchema>;
export type Operation = z.infer<typeof operationSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
