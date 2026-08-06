import { describe, expect, it } from 'vitest';

import { parseWorkerConfig } from './config.js';

describe('worker configuration', () => {
  it('uses a different local port from the public API', () => {
    expect(parseWorkerConfig({}).port).toBe(4001);
  });
});
