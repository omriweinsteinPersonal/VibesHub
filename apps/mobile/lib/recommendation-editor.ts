import type {
  CommercialRelationship,
  CreatorProductMetadata,
  CreatorRecommendation,
  CreatorRecommendationInput,
} from '@vibeshub/contracts';

export interface RecommendationDraft {
  additionalImages: { imageAssetId: string; url: string }[];
  brandDiscountCodeId: string;
  brandName: string;
  categoryId: string;
  categoryIds: string[];
  collectionIds: string[];
  commercialRelationship: CommercialRelationship;
  contentKind: 'link' | 'product';
  discountCode: string;
  discountExpiresAt: string;
  discountType: 'amount' | 'percent';
  discountValue: string;
  imageAssetId: string;
  imageUrl: string;
  instagramStoryUrl: string;
  priceIls: string;
  productName: string;
  productUrl: string;
  review: string;
  storyClips: { mediaAssetId: string; url: string }[];
  storyLink: string;
  videoUrl: string;
}

export const emptyRecommendationDraft: RecommendationDraft = {
  additionalImages: [],
  brandDiscountCodeId: '',
  brandName: '',
  categoryId: '',
  categoryIds: [],
  collectionIds: [],
  commercialRelationship: 'organic',
  contentKind: 'product',
  discountCode: '',
  discountExpiresAt: '',
  discountType: 'percent',
  discountValue: '',
  imageAssetId: '',
  imageUrl: '',
  instagramStoryUrl: '',
  priceIls: '',
  productName: '',
  productUrl: '',
  review: '',
  storyClips: [],
  storyLink: '',
  videoUrl: '',
};

export function recommendationDraftFromItem(
  item: CreatorRecommendation,
): RecommendationDraft {
  return {
    additionalImages: (item.images ?? []).slice(1).map((image) => ({
      imageAssetId: image.imageAssetId ?? '',
      url: image.url,
    })),
    brandDiscountCodeId: '',
    brandName: item.brandName,
    categoryId: item.categoryId,
    categoryIds: item.categoryIds,
    collectionIds: [],
    commercialRelationship: item.commercialRelationship,
    contentKind: item.contentKind,
    discountCode: item.discount?.code ?? '',
    discountExpiresAt: item.discount?.expiresAt?.slice(0, 10) ?? '',
    discountType: item.discount?.label?.includes('%') ? 'percent' : 'amount',
    discountValue: (item.discount?.label ?? '').replace(/[^0-9.]/gu, ''),
    imageAssetId: item.imageAssetId ?? '',
    imageUrl: item.imageAssetId ? '' : item.imageUrl,
    instagramStoryUrl: item.instagramStoryUrl ?? '',
    priceIls: item.price.amountMinor ? String(item.price.amountMinor / 100) : '',
    productName: item.productName,
    productUrl: item.productUrl,
    review: item.review.value,
    storyClips: item.storyClips.map((clip) => ({
      mediaAssetId: clip.mediaAssetId ?? '',
      url: clip.url,
    })),
    storyLink: '',
    videoUrl: item.videoUrl ?? '',
  };
}

export function recommendationDraftWithMetadata(
  draft: RecommendationDraft,
  metadata: CreatorProductMetadata,
  categoryId?: string,
): RecommendationDraft {
  return {
    ...draft,
    additionalImages: draft.imageAssetId
      ? draft.additionalImages
      : metadata.imageUrls.slice(1).map((url) => ({ imageAssetId: '', url })),
    brandName: metadata.brandName || draft.brandName,
    categoryId: categoryId || draft.categoryId,
    categoryIds: categoryId ? [categoryId] : draft.categoryIds,
    imageUrl: draft.imageAssetId ? draft.imageUrl : metadata.imageUrl || draft.imageUrl,
    priceIls:
      metadata.priceAmountMinor === null
        ? draft.priceIls
        : String(metadata.priceAmountMinor / 100),
    productName: metadata.productName || draft.productName,
    productUrl: metadata.productUrl,
    review: metadata.description?.slice(0, 1_000) || draft.review,
  };
}

export function recommendationInput(
  draft: RecommendationDraft,
  manualId: string,
): CreatorRecommendationInput {
  const productName = draft.productName.trim();
  const brandName = draft.contentKind === 'link' ? 'Links' : draft.brandName.trim();
  const categoryIds = draft.categoryIds.length
    ? draft.categoryIds
    : draft.categoryId
      ? [draft.categoryId]
      : [];
  const categoryId = categoryIds[0]?.trim() ?? '';
  if (!productName) throw new Error('Add an item name.');
  if (!brandName) throw new Error('Choose or enter a brand.');
  if (!categoryId) throw new Error('Choose a category.');

  const price = draft.priceIls.trim() ? Number(draft.priceIls) : 0;
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price * 100)) {
    throw new Error('Enter a valid price with up to two decimal places.');
  }
  const discountValue = draft.discountValue.trim()
    ? Number(draft.discountValue.trim())
    : null;
  if (
    discountValue !== null &&
    (!Number.isFinite(discountValue) ||
      discountValue <= 0 ||
      (draft.discountType === 'percent' &&
        (!Number.isInteger(discountValue) || discountValue > 100)) ||
      (draft.discountType === 'amount' && !Number.isInteger(discountValue * 100)))
  ) {
    throw new Error('Enter a valid discount value.');
  }

  const productUrl = optionalHttpsUrl(draft.productUrl, 'item link');
  const imageUrl = optionalHttpsUrl(draft.imageUrl, 'image link');
  const instagramStoryUrl = optionalInstagramStoryUrl(draft.instagramStoryUrl);
  const storyClips = draft.storyClips.map((clip) =>
    clip.mediaAssetId
      ? { mediaAssetId: clip.mediaAssetId }
      : { videoUrl: requiredHttpsUrl(clip.url, 'story video link') },
  );
  return {
    additionalImages:
      draft.contentKind === 'link'
        ? []
        : draft.additionalImages.map((image) =>
            image.imageAssetId
              ? { imageAssetId: image.imageAssetId }
              : { imageUrl: requiredHttpsUrl(image.url, 'additional image link') },
          ),
    brandDiscountCodeId: draft.brandDiscountCodeId || null,
    brandName,
    categoryId,
    categoryIds,
    commercialRelationship: draft.commercialRelationship,
    contentKind: draft.contentKind,
    discountAmountMinor:
      !draft.brandDiscountCodeId &&
      draft.discountType === 'amount' &&
      discountValue !== null
        ? Math.round(discountValue * 100)
        : null,
    discountCode:
      draft.brandDiscountCodeId || !draft.discountCode.trim()
        ? null
        : draft.discountCode.trim(),
    discountExpiresAt:
      draft.brandDiscountCodeId || !draft.discountExpiresAt
        ? null
        : new Date(`${draft.discountExpiresAt}T23:59:59.000Z`).toISOString(),
    discountLabel:
      draft.brandDiscountCodeId || discountValue === null
        ? null
        : draft.discountType === 'percent'
          ? `${discountValue}% off`
          : `₪${discountValue} off`,
    discountPercent:
      !draft.brandDiscountCodeId &&
      draft.discountType === 'percent' &&
      discountValue !== null
        ? discountValue
        : null,
    imageAssetId: draft.imageAssetId || null,
    imageUrl: draft.imageAssetId ? null : imageUrl,
    instagramStoryUrl,
    priceAmountMinor: draft.contentKind === 'link' ? 0 : Math.round(price * 100),
    productName,
    productUrl: productUrl || `https://swavii.com/manual-recommendation/${manualId}`,
    reviewHe:
      draft.contentKind === 'link'
        ? 'Link card'
        : draft.review.trim() || 'No written review yet.',
    storyClips: draft.contentKind === 'link' ? [] : storyClips,
    videoUrl:
      draft.contentKind === 'link'
        ? null
        : optionalHttpsUrl(draft.videoUrl, 'video preview link'),
  };
}

function optionalInstagramStoryUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const path = url.pathname.toLowerCase();
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      (!['instagram.com', 'www.instagram.com'].includes(url.hostname) &&
        url.hostname !== 'ig.me') ||
      (url.hostname === 'ig.me'
        ? url.pathname.length <= 1
        : !['/stories/', '/s/', '/share/', '/highlights/'].some((prefix) =>
            path.startsWith(prefix),
          ))
    ) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new Error('Use a valid HTTPS Instagram Story or Highlight link.');
  }
}

function requiredHttpsUrl(value: string, label: string): string {
  const url = optionalHttpsUrl(value, label);
  if (!url) throw new Error(`Enter a valid HTTPS ${label}.`);
  return url;
}

function optionalHttpsUrl(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'https:') throw new Error();
    return url.toString();
  } catch {
    throw new Error(`Enter a valid HTTPS ${label}, or leave it empty.`);
  }
}
