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

  it('reads numeric and localized offer prices', () => {
    const numeric = `<script type="application/ld+json">{
      "@type":"Product", "name":"Numeric price", "offers":{"price":129.9}
    }</script>`;
    const localized = `<script type="application/ld+json">{
      "@type":"Product", "name":"Localized price", "offers":{"lowPrice":"₪1,299.90"}
    }</script>`;
    expect(
      parseProductMetadata(numeric, 'https://shop.example/numeric').priceAmountMinor,
    ).toBe(12_990);
    expect(
      parseProductMetadata(localized, 'https://shop.example/localized').priceAmountMinor,
    ).toBe(129_990);
  });

  it('extracts title, gallery images, and visible prices from dynamic merchant HTML', () => {
    const html = `
      <title>501® Original Fit Women's Jeans - Light Wash | Levi's® US</title>
      <meta property="og:site_name" content="Levi's">
      <img alt="501® Original Fit Women's Jeans" src="//lscoglobal.scene7.com/jeans-1.jpg">
      <img alt="501® Original Fit Women's Jeans" data-src="https://lscoglobal.scene7.com/jeans-2.jpg">
      <div>Sale price is $82.98 Original Price Was $110.00</div>`;
    expect(
      parseProductMetadata(html, 'https://www.levi.com/US/en_US/p/125010415'),
    ).toMatchObject({
      brandName: "Levi's",
      imageUrl: 'https://lscoglobal.scene7.com/jeans-1.jpg',
      imageUrls: [
        'https://lscoglobal.scene7.com/jeans-1.jpg',
        'https://lscoglobal.scene7.com/jeans-2.jpg',
      ],
      priceAmountMinor: 8_298,
      productName: "501® Original Fit Women's Jeans - Light Wash",
    });
  });

  it('uses the human-readable slug instead of a numeric product id', () => {
    expect(
      productMetadataFromUrl(
        'https://www.levi.com/US/en_US/clothing/women/jeans/straight/501-original-fit-womens-jeans/p/125010415',
      ).productName,
    ).toBe('501 original fit womens jeans');
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
      const requestedUrl = fetchMock.mock.calls[0]?.[0];
      expect(requestedUrl).toBeInstanceOf(URL);
      expect((requestedUrl as URL).href).toBe(
        'https://weshoes.co.il/products/desb1184-001.js',
      );
    } finally {
      fetchMock.mockRestore();
    }
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

    try {
      await expect(
        new ProductMetadataService().fetch(
          'https://fox.co.il/collections/mens/products/1164375802',
        ),
      ).resolves.toMatchObject({ brandName: 'Fox' });
    } finally {
      fetchMock.mockRestore();
    }
  });
});
