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

  it('extracts brands from manufacturer metadata and itemprop fallbacks', () => {
    const jsonLdHtml = `
      <meta property="og:site_name" content="Terminal X">
      <script type="application/ld+json">{
        "@type":"Product",
        "name":"Everyday Sneakers",
        "manufacturer":{"@type":"Organization","name":"Nordé"}
      }</script>`;
    expect(
      parseProductMetadata(jsonLdHtml, 'https://www.terminalx.com/products/sneakers')
        .brandName,
    ).toBe('Nordé');

    const itempropHtml = `
      <meta itemprop="brand" content="Rare Beauty">
      <meta property="og:title" content="Soft Pinch Liquid Blush">`;
    expect(
      parseProductMetadata(itempropHtml, 'https://shop.example/products/blush').brandName,
    ).toBe('Rare Beauty');
  });

  it('uses the merchant identity as a last-resort brand', () => {
    expect(
      parseProductMetadata(
        '<meta property="og:title" content="A product">',
        'https://www.example-store.co.il/products/one',
      ).brandName,
    ).toBe('Example Store');
  });
});
