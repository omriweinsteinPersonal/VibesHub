import { describe, expect, it } from 'vitest';

import {
  isRedundantBrandTitleLine,
  splitBilingualProductTitle,
} from './bilingual-product-title';

describe('splitBilingualProductTitle', () => {
  it('separates mixed Hebrew and English product names', () => {
    expect(splitBilingualProductTitle('Desigual Bag - תיק יד שחור')).toEqual({
      english: 'Desigual Bag',
      firstLanguage: 'en',
      hebrew: 'תיק יד שחור',
    });
    expect(splitBilingualProductTitle('נעלי טניס GAMECOURT 2')).toEqual({
      english: 'GAMECOURT 2',
      firstLanguage: 'he',
      hebrew: 'נעלי טניס',
    });
    expect(splitBilingualProductTitle('FOX-חולצה')).toEqual({
      english: 'FOX',
      firstLanguage: 'en',
      hebrew: 'חולצה',
    });
    expect(splitBilingualProductTitle('Nike(נייק)')).toEqual({
      english: 'Nike',
      firstLanguage: 'en',
      hebrew: 'נייק',
    });
  });

  it('preserves the source-language order for storefront titles', () => {
    expect(splitBilingualProductTitle('MUM6N11 מיקסר MUM6 800 W לבן, אפור')).toEqual({
      english: 'MUM6N11 MUM6 800 W',
      firstLanguage: 'en',
      hebrew: 'מיקסר לבן, אפור',
    });
    expect(
      splitBilingualProductTitle(
        'סטיקי ביף "בשר דביק" | קפה טאיזו | שף יובל בן-נריה | Wolt',
      ),
    ).toEqual({
      english: 'Wolt',
      firstLanguage: 'he',
      hebrew: 'סטיקי ביף "בשר דביק" קפה טאיזו שף יובל בן-נריה',
    });
  });

  it('keeps short measurement units in the natural bidi sentence', () => {
    expect(
      splitBilingualProductTitle('סדרה 6 מכונת כביסה פתח קדמי 9 kg מקסימום 1400 סל"ד'),
    ).toBeNull();
  });

  it('leaves single-language titles to the browser bidi algorithm', () => {
    expect(splitBilingualProductTitle('Soft Pinch Liquid Blush')).toBeNull();
    expect(splitBilingualProductTitle('תיק יד שחור')).toBeNull();
  });

  it('recognizes a title line that only repeats the shelf brand', () => {
    expect(isRedundantBrandTitleLine('Wolt', 'WOLT')).toBe(true);
    expect(isRedundantBrandTitleLine('Wolt |', 'Wolt')).toBe(true);
    expect(isRedundantBrandTitleLine('Wolt Market', 'Wolt')).toBe(false);
  });
});
