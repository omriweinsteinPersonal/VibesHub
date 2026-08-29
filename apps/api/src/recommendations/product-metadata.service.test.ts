import { describe, expect, it } from 'vitest';

import { parseProductMetadata } from './product-metadata.service.js';

describe('parseProductMetadata', () => {
  it('prefers product JSON-LD and resolves relative images', () => {
    const html = `
      <meta property="og:title" content="Fallback title">
      <script type="application/ld+json">{
        "@type":"Product",
        "name":"Glow Serum",
        "brand":{"@type":"Brand","name":"Levody"},
        "image":"/serum.jpg",
        "offers":{"price":"189.90"}
      }</script>`;
    expect(parseProductMetadata(html, 'https://shop.example/products/serum')).toEqual({
      brandName: 'Levody',
      imageUrl: 'https://shop.example/serum.jpg',
      priceAmountMinor: 18_990,
      productName: 'Glow Serum',
      productUrl: 'https://shop.example/products/serum',
    });
  });
});
