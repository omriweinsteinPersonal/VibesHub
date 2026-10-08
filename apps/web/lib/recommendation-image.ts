const recommendationImagePlaceholder = '/images/link-card-placeholder.svg';

export function hasRecommendationImage(
  imageUrl: string | null | undefined,
): imageUrl is string {
  return Boolean(imageUrl && !imageUrl.endsWith(recommendationImagePlaceholder));
}
