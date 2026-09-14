import { describe, expect, it, vi } from 'vitest';

import {
  parseProductMetadata,
  productMetadataFromUrl,
  suggestCategorySlug,
} from './product-metadata.service.js';

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
      categorySlug: 'skincare',
      description: null,
      imageUrl: 'https://shop.example/serum.jpg',
      imageUrls: ['https://shop.example/serum.jpg'],
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
    ).toBe('Terminal X');

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

  it('derives useful fallback details from blocked product URLs', () => {
    expect(
      productMetadataFromUrl(
        'https://www.adidas.co.il/he/%D7%A0%D7%A2%D7%9C%D7%99-samba-og/KK2267.html',
      ),
    ).toEqual({
      brandName: 'Adidas',
      categorySlug: 'fashion',
      description: null,
      imageUrl: null,
      imageUrls: [],
      priceAmountMinor: null,
      productName: 'נעלי samba og',
      productUrl:
        'https://www.adidas.co.il/he/%D7%A0%D7%A2%D7%9C%D7%99-samba-og/KK2267.html',
    });
  });

  it('reads prices from arrays of JSON-LD offers', () => {
    const html = `<script type="application/ld+json">{
      "@type":"Product",
      "name":"Samba OG",
      "offers":[{"priceSpecification":{"price":"499.90"}}]
    }</script>`;
    expect(
      parseProductMetadata(html, 'https://adidas.co.il/product').priceAmountMinor,
    ).toBe(49_990);
  });
});

describe('ProductMetadataService Shopify import', () => {
  it('classifies a toaster grill as food', () => {
    expect(
      suggestCategorySlug([
        'מכונת גריל וכריכים דיגיטלית ANYPRESS MASTER',
        'מוצרי חשמל למטבח',
      ]),
    ).toBe('food');
  });

  it('uses the product narrative instead of technical specifications', async () => {
    const { ProductMetadataService } = await import('./product-metadata.service.js');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          title: 'Desigual Bag',
          vendor: 'Desigual',
          price: 35991,
          images: ['//cdn.shopify.com/product.jpg'],
          description:
            '<p><strong>Desigual Bag</strong><br><br>תיק יד בינוני מבד דמוי עור.<br><br>מפרט טכני:<br><br>מותג: Desigual</p>',
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
    try {
      await expect(
        new ProductMetadataService().fetch(
          'https://weshoes.co.il/collections/bags/products/desb1184-001',
        ),
      ).resolves.toMatchObject({
        brandName: 'WeShoes',
        categorySlug: 'fashion',
        description: 'תיק יד בינוני מבד דמוי עור.',
        imageUrls: ['https://cdn.shopify.com/product.jpg'],
        priceAmountMinor: 35991,
      });
      expect(fetchMock.mock.calls[0]?.[0].toString()).toBe(
        'https://weshoes.co.il/products/desb1184-001.js',
      );
    } finally {
      fetchMock.mockRestore();
    }
      });
  });

  it('uses the Shopify storefront identity instead of a category vendor', async () => {
    const { ProductMetadataService } = await import('./product-metadata.service.js');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          description: '<p>Swim shorts</p>',
          images: ['https://cdn.shopify.com/fox-shorts.jpg'],
          price: 9990,
          title: 'Swim shorts',
          vendor: 'גברים',
        }),
        { status: 200 },
      ),
    );

    await expect(
      new ProductMetadataService().fetch(
        'https://fox.co.il/collections/mens/products/1164375802',
      ),
    ).resolves.toMatchObject({ brandName: 'Fox' });

    fetchMock.mockRestore();
  });
