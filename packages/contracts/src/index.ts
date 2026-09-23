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

const publicAssetUrlSchema = z
  .url()
  .max(2_048)
  .refine(isProductionOrLocalUrl, 'Use HTTPS outside local development');

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
    avatarUrl: publicAssetUrlSchema.nullable(),
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
const optionalInstagramStoryUrlSchema = z
  .url({ protocol: /^https$/ })
  .max(2_048)
  .refine((value) => {
    const url = new URL(value);
    return (
      ['instagram.com', 'www.instagram.com'].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname.startsWith('/stories/')
    );
  }, 'Use an Instagram story or Highlight link')
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

export const recommendationReviewSchema = z.string().trim().min(1).max(1_000);

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
    publicUrl: publicAssetUrlSchema,
    sizeBytes: z
      .int()
      .min(1)
      .max(5 * 1_024 * 1_024),
    status: z.literal('ready'),
  })
  .strict();

export const storyVideoContentTypeSchema = z.enum([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

export const storyVideoUploadInputSchema = z
  .object({
    contentType: storyVideoContentTypeSchema,
    fileSizeBytes: z
      .int()
      .min(1)
      .max(50 * 1_024 * 1_024),
  })
  .strict();

export const storyVideoUploadSchema = z
  .object({
    assetId: idSchema,
    bucket: z.literal('story-video-uploads'),
    contentType: storyVideoContentTypeSchema,
    expiresAt: z.iso.datetime(),
    objectPath: z.string().trim().min(1).max(512),
    token: z.string().trim().min(1),
  })
  .strict();

export const storyVideoAssetSchema = z
  .object({
    contentType: storyVideoContentTypeSchema,
    id: idSchema,
    publicUrl: publicAssetUrlSchema,
    sizeBytes: z
      .int()
      .min(1)
      .max(50 * 1_024 * 1_024),
    status: z.literal('ready'),
  })
  .strict();

export const storyClipInputSchema = z
  .object({
    mediaAssetId: idSchema.nullable().optional(),
    videoUrl: optionalHttpsUrlSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      Number(Boolean(value.mediaAssetId)) + Number(Boolean(value.videoUrl)) === 1,
    'Choose exactly one story clip source',
  );

export const storyClipSchema = z
  .object({
    id: idSchema,
    mediaAssetId: idSchema.nullable(),
    position: z.int().nonnegative(),
    url: publicAssetUrlSchema,
  })
  .strict();

export const recommendationImageInputSchema = z
  .object({
    imageAssetId: idSchema.nullable().optional(),
    imageUrl: optionalHttpsUrlSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      Number(Boolean(value.imageAssetId)) + Number(Boolean(value.imageUrl)) === 1,
    'Choose exactly one image source',
  );

export const recommendationImageSchema = z
  .object({
    id: idSchema.nullable(),
    imageAssetId: idSchema.nullable(),
    position: z.int().nonnegative(),
    url: publicAssetUrlSchema,
  })
  .strict();

const creatorRecommendationInputFieldsSchema = z
  .object({
    brandName: z.string().trim().min(1).max(120),
    categoryId: idSchema,
    categoryIds: z.array(idSchema).min(1).max(8).optional(),
    commercialRelationship: commercialRelationshipSchema.default('organic'),
    discountCode: optionalTrimmedStringSchema(50).optional(),
    discountExpiresAt: z.iso.datetime().nullable().optional(),
    discountLabel: optionalTrimmedStringSchema(100).optional(),
    imageAssetId: idSchema.nullable().optional(),
    imageUrl: optionalHttpsUrlSchema.optional(),
    instagramStoryUrl: optionalInstagramStoryUrlSchema.optional(),
    additionalImages: z.array(recommendationImageInputSchema).max(9).optional(),
    priceAmountMinor: z.int().nonnegative(),
    productName: z.string().trim().min(1).max(200),
    productUrl: z.url({ protocol: /^https$/ }).max(2_048),
    reviewHe: recommendationReviewSchema,
    storyClips: z.array(storyClipInputSchema).max(10).optional(),
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

export const creatorProductMetadataInputSchema = z
  .object({
    url: z.url({ protocol: /^https$/ }).max(2_048),
  })
  .strict();

export const creatorProductMetadataSchema = z
  .object({
    brandName: z.string().trim().max(120).nullable(),
    categorySlug: z.string().trim().max(80).nullable(),
    description: z.string().trim().max(2_000).nullable(),
    imageUrl: z
      .url({ protocol: /^https$/ })
      .max(2_048)
      .nullable(),
    imageUrls: z.array(z.url({ protocol: /^https$/ }).max(2_048)).max(10),
    priceAmountMinor: z.int().nonnegative().nullable(),
    productName: z.string().trim().max(200).nullable(),
    productUrl: z.url({ protocol: /^https$/ }).max(2_048),
  })
  .strict();

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
    instagramTaps: z.int().nonnegative(),
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
          categoryName: z.string().trim().min(1),
          categorySlug: z.string().trim().min(1),
          id: idSchema,
          imageUrl: publicAssetUrlSchema.nullable(),
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
    brandId: idSchema.nullable().default(null),
    code: z
      .string()
      .trim()
      .max(50)
      .regex(/^\S*$/, 'Discount codes cannot contain spaces')
      .transform((value) => value.toUpperCase())
      .nullable(),
    detailsHe: z
      .string()
      .trim()
      .min(1)
      .max(1_000)
      .refine((value) => /[א-ת]/u.test(value), 'Hebrew details are required')
      .nullable(),
    expiresAt: z.iso.datetime().nullable(),
    discountPercent: z.number().int().min(1).max(100).nullable().default(null),
    label: z.string().trim().min(1).max(100).nullable(),
    merchantUrl: z.url({ protocol: /^https$/ }).max(2_048),
    offerType: z.enum(['creator_code', 'brand_promotion']).default('creator_code'),
    priority: z.number().int().min(-1_000).max(1_000).default(0),
    recurrenceRule: z.enum(['none', 'month_end_week']).default('none'),
    scopeId: idSchema.nullable().default(null),
    scopeKind: z.enum(['brand', 'collection', 'item']).default('brand'),
    source: z.enum(['manual', 'external']).default('manual'),
    stackable: z.boolean().default(false),
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
    brandId: idSchema.nullable(),
    code: z.string().trim().min(1).max(50).nullable(),
    details: directionalTextSchema.nullable(),
    discountPercent: z.number().int().min(1).max(100).nullable(),
    expiresAt: z.iso.datetime().nullable(),
    id: idSchema,
    label: z.string().trim().min(1).max(100).nullable(),
    lastVerifiedAt: z.iso.datetime().nullable(),
    merchantHostname: z.string().trim().min(4).max(253),
    merchantName: z.string().trim().min(1).max(160),
    merchantUrl: z.url({ protocol: /^https$/ }).max(2_048),
    offerType: z.enum(['creator_code', 'brand_promotion']),
    priority: z.number().int(),
    recurrenceRule: z.enum(['none', 'month_end_week']),
    scopeId: idSchema.nullable(),
    scopeKind: z.enum(['brand', 'collection', 'item']),
    source: z.enum(['manual', 'external']),
    stackable: z.boolean(),
    startsAt: z.iso.datetime().nullable(),
    verificationStatus: discountCodeVerificationStatusSchema,
  })
  .strict();

export const creatorDiscountCodeSchema = publicDiscountCodeSchema
  .extend({
    lifecycle: discountCodeLifecycleSchema,
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
    imageUrl: publicAssetUrlSchema,
    instagramStoryUrl: optionalInstagramStoryUrlSchema.default(null),
    images: z.array(recommendationImageSchema).max(10).optional(),
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
    storyClips: z.array(storyClipSchema).max(10).default([]),
    videoUrl: optionalHttpsUrlSchema,
  })
  .strict();

export const creatorRecommendationSchema = recommendationCardSchema
  .extend({
    brandId: idSchema,
    categoryId: idSchema,
    categoryIds: z.array(idSchema).min(1).max(8),
    position: z.int().nonnegative(),
    productUrl: z.url({ protocol: /^https$/ }).max(2_048),
  })
  .strict();

const storefrontColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const defaultStorefrontTheme = {
  profileBackground: '#fbf6ec',
  recommendationsBackground: '#ffffff',
  productBackground: '#ffffff',
  discountBackground: '#f8f6f2',
  collectionBackground: '#fbf9f6',
  accentColor: '#b77856',
  textColor: '#30251f',
} as const;

export const storefrontThemeSchema = z
  .object({
    profileBackground: storefrontColorSchema,
    recommendationsBackground: storefrontColorSchema,
    productBackground: storefrontColorSchema,
    discountBackground: storefrontColorSchema,
    collectionBackground: storefrontColorSchema,
    accentColor: storefrontColorSchema,
    textColor: storefrontColorSchema,
  })
  .strict();

export const storefrontThemeConfigurationSchema = z
  .object({
    theme: storefrontThemeSchema,
    version: z.int().positive(),
  })
  .strict();

export const creatorStorefrontSchema = z
  .object({
    avatarUrl: publicAssetUrlSchema.nullable(),
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
    brands: z
      .array(
        z
          .object({
            brandId: idSchema,
            collectionCount: z.int().nonnegative(),
            id: idSchema,
            itemCount: z.int().nonnegative(),
            name: z.string().trim().min(1).max(120),
            websiteUrl: z.url({ protocol: /^https$/ }).max(2_048),
          })
          .strict(),
      )
      .max(100)
      .default([]),
    storefrontSections: z
      .array(categoryCardSchema.pick({ id: true, name: true, slug: true }))
      .max(24)
      .default([]),
    curatedSections: z
      .array(
        z
          .object({
            id: idSchema,
            kind: z.enum(['section', 'collection', 'page']),
            brandId: idSchema.nullable().default(null),
            title: z.string().trim().min(1).max(80),
            description: z.string().trim().max(240).default(''),
            imageUrl: publicAssetUrlSchema.nullable().default(null),
            parentCollectionId: idSchema.nullable().default(null),
            recommendationIds: z.array(idSchema).max(20),
            showItemsIndividually: z.boolean().default(false),
          })
          .strict(),
      )
      .max(24)
      .default([]),
    contentOrder: z
      .array(
        z
          .object({
            kind: z.enum([
              'recommendation',
              'discount',
              'collection',
              'section',
              'category',
            ]),
            id: idSchema,
          })
          .strict(),
      )
      .max(200)
      .default([]),
    labels: z
      .array(
        z.object({
          id: idSchema,
          title: z.string().trim().min(1).max(40),
          categorySlug: z.string().trim().max(80).nullable(),
          recommendationIds: z.array(idSchema).max(100),
        }).strict(),
      )
      .max(12)
      .default([]),
    theme: storefrontThemeSchema.default(defaultStorefrontTheme),
    socialLinks: z.array(
      z
        .object({
          handle: z.string().trim().max(100).nullable(),
          platform: z.enum([
            'instagram',
            'tiktok',
            'linkedin',
            'x',
            'youtube',
            'facebook',
            'pinterest',
            'website',
          ]),
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

export const publicRecommendationDetailSchema = recommendationCardSchema
  .extend({ creator: recommendationCreatorSchema })
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

export const socialPlatformSchema = z.enum([
  'instagram',
  'tiktok',
  'linkedin',
  'x',
  'youtube',
  'facebook',
  'pinterest',
  'website',
]);

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
        url: publicAssetUrlSchema,
      })
      .strict()
      .nullable(),
    bioHe: z.string().trim().min(1).max(1_000),
    displayName: z.string().trim().min(1).max(100),
    handle: creatorCardSchema.shape.handle,
    id: idSchema,
    primaryCategory: categoryCardSchema.pick({ id: true, name: true, slug: true }),
    socialLinks: z.array(creatorProfileSocialLinkSchema).max(8),
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
    handle: creatorCardSchema.shape.handle.optional(),
    primaryCategoryId: idSchema.optional(),
    socialLinks: z
      .array(creatorProfileSocialLinkSchema)
      .max(8)
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

export const storefrontSectionSchema = z
  .object({
    category: categoryCardSchema.pick({ id: true, name: true, slug: true }),
    position: z.int().nonnegative(),
  })
  .strict();

export const curatedSectionSchema = z
  .object({
    brandId: idSchema.nullable().default(null),
    id: idSchema,
    kind: z.enum(['section', 'collection', 'page']),
    title: z.string().trim().min(1).max(80),
    description: z.string().trim().max(240).default(''),
    imageUrl: publicAssetUrlSchema.nullable().default(null),
    parentCollectionId: idSchema.nullable().default(null),
    recommendationIds: z.array(idSchema).max(20),
    showItemsIndividually: z.boolean().default(false),
  })
  .strict();

export const creatorBrandInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    websiteUrl: z.url({ protocol: /^https$/ }).max(2_048),
  })
  .strict();

export const creatorBrandSchema = creatorBrandInputSchema
  .extend({
    brandId: idSchema,
    id: idSchema,
    itemCount: z.int().nonnegative(),
    collectionCount: z.int().nonnegative(),
    version: z.int().positive(),
  })
  .strict();

export const creatorStorefrontConfigurationSchema = z
  .object({
    sections: z.array(storefrontSectionSchema).max(24),
    curatedSections: z.array(curatedSectionSchema).max(24).default([]),
    contentOrder: z
      .array(
        z
          .object({
            kind: z.enum([
              'recommendation',
              'discount',
              'collection',
              'section',
              'category',
            ]),
            id: idSchema,
          })
          .strict(),
      )
      .max(200)
      .default([]),
    labels: z
      .array(
        z.object({
          id: idSchema,
          title: z.string().trim().min(1).max(40),
          categorySlug: z.string().trim().max(80).nullable(),
          recommendationIds: z.array(idSchema).max(100),
        }).strict(),
      )
      .max(12)
      .default([]),
    version: z.int().positive(),
  })
  .strict();

export const creatorStorefrontConfigurationInputSchema = z
  .object({
    contentOrder: z
      .array(
        z
          .object({
            kind: z.enum([
              'recommendation',
              'discount',
              'collection',
              'section',
              'category',
            ]),
            id: idSchema,
          })
          .strict(),
      )
      .max(200)
      .default([]),
    categoryIds: z
      .array(idSchema)
      .max(24)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        'Each storefront section can be selected once',
      ),
    curatedSections: z
      .array(curatedSectionSchema)
      .max(24)
      .default([])
      .refine(
        (sections) => new Set(sections.map(({ id }) => id)).size === sections.length,
        'Each custom section can be selected once',
      ),
    labels: z
      .array(
        z.object({
          id: idSchema,
          title: z.string().trim().min(1).max(40),
          categorySlug: z.string().trim().max(80).nullable(),
          recommendationIds: z.array(idSchema).max(100),
        }).strict(),
      )
      .max(12)
      .default([])
      .refine(
        (labels) => new Set(labels.map(({ id }) => id)).size === labels.length,
        'Each storefront label can be selected once',
      ),
  })
  .strict();

const nullableNonnegativeInteger = z.int().nonnegative().nullable();

const creatorMediaKitFieldsSchema = z
  .object({
    agentAgencyName: z.string().trim().max(160).nullable(),
    agentEmail: z.email().max(320).nullable(),
    agentPhone: z.string().trim().max(40).nullable(),
    audienceAgeFrom: z.int().min(13).max(100).nullable(),
    audienceAgeTo: z.int().min(13).max(100).nullable(),
    audienceGender: z.enum(['female', 'male', 'mixed', 'not_specified']).nullable(),
    audienceLocation: z.string().trim().max(120).nullable(),
    averageReelViews: nullableNonnegativeInteger,
    averageStoryViews: nullableNonnegativeInteger,
    bookingEmail: z.email().max(320).nullable(),
    contentTypes: z.array(z.enum(['stories', 'reels', 'posts'])).max(3),
    engagementRate: z.number().min(0).max(100).nullable(),
    followers: nullableNonnegativeInteger,
    platforms: z.array(z.enum(['instagram', 'tiktok', 'youtube'])).max(3),
    ratePerPostMinor: nullableNonnegativeInteger,
    ratePerStoryMinor: nullableNonnegativeInteger,
    version: z.int().positive(),
  })
  .strict();

export const creatorMediaKitSchema = creatorMediaKitFieldsSchema.refine(
  (value) =>
    value.audienceAgeFrom === null ||
    value.audienceAgeTo === null ||
    value.audienceAgeTo >= value.audienceAgeFrom,
  { message: 'Audience maximum age must be at least the minimum age' },
);

export const creatorMediaKitInputSchema = creatorMediaKitFieldsSchema
  .omit({ version: true })
  .refine(
    (value) => new Set(value.platforms).size === value.platforms.length,
    'Use each platform once',
  )
  .refine(
    (value) => new Set(value.contentTypes).size === value.contentTypes.length,
    'Use each content type once',
  );

export const creatorStudioSummarySchema = z
  .object({
    avatarUrl: publicAssetUrlSchema.nullable(),
    counts: z
      .object({
        brandDiscounts: z.int().nonnegative(),
        collections: z.int().nonnegative(),
        recommendations: z.int().nonnegative(),
        storyClips: z.int().nonnegative(),
      })
      .strict(),
    displayName: z.string().trim().min(1).max(100),
    handle: creatorCardSchema.shape.handle,
    id: idSchema,
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
export type CreatorRecommendationMoveInput = z.infer<
  typeof creatorRecommendationMoveInputSchema
>;
export type CreatorRecommendation = z.infer<typeof creatorRecommendationSchema>;
export type CreatorProductMetadata = z.infer<typeof creatorProductMetadataSchema>;
export type CreatorProductMetadataInput = z.infer<
  typeof creatorProductMetadataInputSchema
>;
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
export type StorefrontTheme = z.infer<typeof storefrontThemeSchema>;
export type StorefrontThemeConfiguration = z.infer<
  typeof storefrontThemeConfigurationSchema
>;
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
export type PublicRecommendationDetail = z.infer<typeof publicRecommendationDetailSchema>;
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
export type StoryVideoAsset = z.infer<typeof storyVideoAssetSchema>;
export type StoryVideoContentType = z.infer<typeof storyVideoContentTypeSchema>;
export type StoryVideoUpload = z.infer<typeof storyVideoUploadSchema>;
export type StoryVideoUploadInput = z.infer<typeof storyVideoUploadInputSchema>;
export type StoryClip = z.infer<typeof storyClipSchema>;
export type StoryClipInput = z.infer<typeof storyClipInputSchema>;
export type RecommendationImage = z.infer<typeof recommendationImageSchema>;
export type RecommendationImageInput = z.infer<typeof recommendationImageInputSchema>;
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
export type CreatorMediaKit = z.infer<typeof creatorMediaKitSchema>;
export type CreatorMediaKitInput = z.infer<typeof creatorMediaKitInputSchema>;
export type CreatorStorefrontConfiguration = z.infer<
  typeof creatorStorefrontConfigurationSchema
>;
export type CreatorStorefrontConfigurationInput = z.infer<
  typeof creatorStorefrontConfigurationInputSchema
>;
export type CreatorBrand = z.infer<typeof creatorBrandSchema>;
export type CreatorBrandInput = z.infer<typeof creatorBrandInputSchema>;
export type CreatorStudioSummary = z.infer<typeof creatorStudioSummarySchema>;
export type Money = z.infer<typeof moneySchema>;
export type Operation = z.infer<typeof operationSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
