import { describe, expect, it } from 'vitest';

import { ApiProblem } from '../api-problem.js';
import {
  decodeCreatorDirectoryCursor,
  encodeCreatorDirectoryCursor,
  parseCreatorDirectoryQuery,
} from './creator-directory.js';

describe('creator directory cursors', () => {
  const id = '01989f72-07e4-7f32-9b42-1ba55d4ca010';

  it('round-trips a cursor bound to normalized filters', () => {
    const query = parseCreatorDirectoryQuery({ category: ' Beauty ', q: ' Noa ' });
    const encoded = encodeCreatorDirectoryCursor({ followerCount: 124_000, id }, query);

    expect(decodeCreatorDirectoryCursor(encoded, query)).toMatchObject({
      category: 'beauty',
      followerCount: 124_000,
      id,
      q: 'noa',
    });
  });

  it('rejects a cursor reused with different filters', () => {
    const query = parseCreatorDirectoryQuery({ category: 'beauty' });
    const encoded = encodeCreatorDirectoryCursor({ followerCount: 10, id }, query);

    try {
      decodeCreatorDirectoryCursor(
        encoded,
        parseCreatorDirectoryQuery({ category: 'fashion' }),
      );
      throw new Error('Expected the cursor to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiProblem);
      expect((error as ApiProblem).getResponse()).toMatchObject({
        code: 'VALIDATION_FAILED',
        status: 422,
        title: 'The directory cursor is invalid',
      });
    }
  });
});
