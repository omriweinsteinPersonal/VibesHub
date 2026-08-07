import { describe, expect, it } from 'vitest';

import { databaseClientOptions } from './database.js';

describe('database client options', () => {
  it('is safe for Supavisor transaction pooling', () => {
    expect(databaseClientOptions('production', 2)).toMatchObject({
      max: 2,
      prepare: false,
      ssl: 'require',
    });
  });

  it('keeps prepared statements disabled outside production', () => {
    expect(databaseClientOptions('development', 2)).toMatchObject({
      prepare: false,
      ssl: false,
    });
  });
});
