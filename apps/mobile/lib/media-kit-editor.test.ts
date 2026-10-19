import type { CreatorMediaKit } from '@vibeshub/contracts';
import { describe, expect, it } from 'vitest';

import { mediaKitDraftFrom, mediaKitInput } from './media-kit-editor';

const mediaKit: CreatorMediaKit = {
  agentAgencyName: null,
  agentEmail: null,
  agentPhone: null,
  audienceAgeFrom: 18,
  audienceAgeTo: 34,
  audienceGender: 'mixed',
  audienceLocation: 'Israel',
  averageReelViews: 12000,
  averageStoryViews: 4500,
  bookingEmail: 'creator@example.com',
  contentTypes: ['reels', 'stories'],
  engagementRate: 4.25,
  followers: 125000,
  platforms: ['instagram', 'tiktok'],
  ratePerPostMinor: 250000,
  ratePerStoryMinor: 120050,
  version: 3,
};

describe('native media kit editor', () => {
  it('round-trips the web media-kit fields without losing money precision', () => {
    const { version: _version, ...input } = mediaKit;
    expect(mediaKitInput(mediaKitDraftFrom(mediaKit))).toEqual(input);
  });

  it('normalizes empty optional fields to null', () => {
    const draft = mediaKitDraftFrom(mediaKit);
    expect(
      mediaKitInput({
        ...draft,
        agentAgencyName: '  ',
        audienceAgeFrom: '',
        bookingEmail: '',
        engagementRate: '',
        followers: '',
        ratePerPostIls: '',
      }),
    ).toMatchObject({
      agentAgencyName: null,
      audienceAgeFrom: null,
      bookingEmail: null,
      engagementRate: null,
      followers: null,
      ratePerPostMinor: null,
    });
  });
});
