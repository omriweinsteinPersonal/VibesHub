import type {
  CreatorProductMetadata,
  CreatorRecommendation,
  CreatorRecommendationInput,
} from '@vibeshub/contracts';

export interface RecommendationDraft {
  brandName: string;
  categoryId: string;
  imageAssetId: string;
  imageUrl: string;
  priceIls: string;
  productName: string;
  productUrl: string;
  review: string;
}

export const emptyRecommendationDraft: RecommendationDraft = {
  brandName: '',
  categoryId: '',
  imageAssetId: '',
  imageUrl: '',
  priceIls: '',
  productName: '',
  productUrl: '',
  review: '',
};

export function recommendationDraftFromItem(
  item: CreatorRecommendation,
): RecommendationDraft {
  return {
    brandName: item.brandName,
    categoryId: item.categoryId,
    imageAssetId: item.imageAssetId ?? '',
    imageUrl: item.imageAssetId ? '' : item.imageUrl,
    priceIls: item.price.amountMinor ? String(item.price.amountMinor / 100) : '',
    productName: item.productName,
    productUrl: item.productUrl,
    review: item.review.value,
  };
}

export function recommendationDraftWithMetadata(
  draft: RecommendationDraft,
  metadata: CreatorProductMetadata,
  categoryId?: string,
): RecommendationDraft {
  return {
    ...draft,
    brandName: metadata.brandName || draft.brandName,
    categoryId: categoryId || draft.categoryId,
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
  const brandName = draft.brandName.trim();
  const categoryId = draft.categoryId.trim();
  if (!productName) throw new Error('Add an item name.');
  if (!brandName) throw new Error('Choose or enter a brand.');
  if (!categoryId) throw new Error('Choose a category.');

  const price = draft.priceIls.trim() ? Number(draft.priceIls) : 0;
  if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price * 100)) {
    throw new Error('Enter a valid price with up to two decimal places.');
  }

  const productUrl = optionalHttpsUrl(draft.productUrl, 'item link');
  const imageUrl = optionalHttpsUrl(draft.imageUrl, 'image link');
  return {
    brandName,
    categoryId,
    categoryIds: [categoryId],
    commercialRelationship: 'organic',
    contentKind: 'product',
    imageAssetId: draft.imageAssetId || null,
    imageUrl: draft.imageAssetId ? null : imageUrl,
    priceAmountMinor: Math.round(price * 100),
    productName,
    productUrl: productUrl || `https://swavii.com/manual-recommendation/${manualId}`,
    reviewHe: draft.review.trim() || 'No written review yet.',
  };
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
