import type {
  CreatorStorefrontConfiguration,
  CreatorStorefrontConfigurationInput,
  PublicDiscountCode,
  RecommendationCard,
} from '@vibeshub/contracts';

export type StorefrontLayer = CreatorStorefrontConfigurationInput['contentOrder'][number];

export function storefrontEditOrder(
  configuration: CreatorStorefrontConfiguration,
  recommendations: RecommendationCard[],
  codes: PublicDiscountCode[],
): StorefrontLayer[] {
  const curatedIds = new Set(
    configuration.curatedSections.filter(({ kind }) => kind !== 'page').flatMap(({ recommendationIds }) => recommendationIds),
  );
  const categoryIds = new Set(configuration.sections.map(({ category }) => category.id));
  const sectionKeys = new Set(
    configuration.curatedSections.filter(({ kind }) => kind !== 'page').map(({ id, kind }) => `${kind}:${id}`),
  );
  const result: StorefrontLayer[] = [];
  const seen = new Set<string>();

  function add(layer: StorefrontLayer) {
    const key = `${layer.kind}:${layer.id}`;
    if (seen.has(key)) return;
    if (layer.kind === 'recommendation' && curatedIds.has(layer.id)) return;
    if (layer.kind === 'category' && !categoryIds.has(layer.id)) return;
    if ((layer.kind === 'collection' || layer.kind === 'section') && !sectionKeys.has(key)) return;
    seen.add(key);
    result.push(layer);
  }

  configuration.contentOrder.forEach(add);
  configuration.curatedSections.forEach(({ id, kind }) => {
    if (kind !== 'page') add({ id, kind });
  });
  configuration.sections.forEach(({ category }) => add({ id: category.id, kind: 'category' }));
  recommendations.forEach(({ id }) => add({ id, kind: 'recommendation' }));
  codes.forEach(({ id }) => add({ id, kind: 'discount' }));
  return result;
}
