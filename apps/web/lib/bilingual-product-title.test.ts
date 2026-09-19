import { describe, expect, it } from 'vitest';

import { splitBilingualProductTitle } from './bilingual-product-title';

describe('splitBilingualProductTitle', () => {
  it('separates mixed Hebrew and English product names', () => {
    expect(splitBilingualProductTitle('Desigual Bag - תיק יד שחור')).toEqual({
      english: 'Desigual Bag',
      hebrew: 'תיק יד שחור',
    });
    expect(splitBilingualProductTitle('נעלי טניס GAMECOURT 2')).toEqual({
      english: 'GAMECOURT 2',
      hebrew: 'נעלי טניס',
    });
    expect(splitBilingualProductTitle('FOX-חולצה')).toEqual({
      english: 'FOX',
      hebrew: 'חולצה',
    });
    expect(splitBilingualProductTitle('Nike(נייק)')).toEqual({
      english: 'Nike',
      hebrew: 'נייק',
    });
  });

  it('leaves single-language titles to the browser bidi algorithm', () => {
    expect(splitBilingualProductTitle('Soft Pinch Liquid Blush')).toBeNull();
    expect(splitBilingualProductTitle('תיק יד שחור')).toBeNull();
  });
});
