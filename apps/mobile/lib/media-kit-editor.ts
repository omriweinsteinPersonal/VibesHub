import type { CreatorMediaKit, CreatorMediaKitInput } from '@vibeshub/contracts';

export type MediaKitPlatform = CreatorMediaKit['platforms'][number];
export type MediaKitContentType = CreatorMediaKit['contentTypes'][number];

export interface MediaKitDraft {
  agentAgencyName: string;
  agentEmail: string;
  agentPhone: string;
  audienceAgeFrom: string;
  audienceAgeTo: string;
  audienceGender: NonNullable<CreatorMediaKit['audienceGender']>;
  audienceLocation: string;
  averageReelViews: string;
  averageStoryViews: string;
  bookingEmail: string;
  contentTypes: MediaKitContentType[];
  engagementRate: string;
  followers: string;
  platforms: MediaKitPlatform[];
  ratePerPostIls: string;
  ratePerStoryIls: string;
}

export function mediaKitDraftFrom(mediaKit: CreatorMediaKit): MediaKitDraft {
  return {
    agentAgencyName: mediaKit.agentAgencyName ?? '',
    agentEmail: mediaKit.agentEmail ?? '',
    agentPhone: mediaKit.agentPhone ?? '',
    audienceAgeFrom: showNumber(mediaKit.audienceAgeFrom),
    audienceAgeTo: showNumber(mediaKit.audienceAgeTo),
    audienceGender: mediaKit.audienceGender ?? 'not_specified',
    audienceLocation: mediaKit.audienceLocation ?? 'Israel',
    averageReelViews: showNumber(mediaKit.averageReelViews),
    averageStoryViews: showNumber(mediaKit.averageStoryViews),
    bookingEmail: mediaKit.bookingEmail ?? '',
    contentTypes: mediaKit.contentTypes,
    engagementRate: showNumber(mediaKit.engagementRate),
    followers: showNumber(mediaKit.followers),
    platforms: mediaKit.platforms,
    ratePerPostIls: showMoney(mediaKit.ratePerPostMinor),
    ratePerStoryIls: showMoney(mediaKit.ratePerStoryMinor),
  };
}

export function mediaKitInput(draft: MediaKitDraft): CreatorMediaKitInput {
  return {
    agentAgencyName: nullableText(draft.agentAgencyName),
    agentEmail: nullableText(draft.agentEmail),
    agentPhone: nullableText(draft.agentPhone),
    audienceAgeFrom: nullableInteger(draft.audienceAgeFrom),
    audienceAgeTo: nullableInteger(draft.audienceAgeTo),
    audienceGender: draft.audienceGender,
    audienceLocation: nullableText(draft.audienceLocation),
    averageReelViews: nullableInteger(draft.averageReelViews),
    averageStoryViews: nullableInteger(draft.averageStoryViews),
    bookingEmail: nullableText(draft.bookingEmail),
    contentTypes: draft.contentTypes,
    engagementRate: nullableDecimal(draft.engagementRate),
    followers: nullableInteger(draft.followers),
    platforms: draft.platforms,
    ratePerPostMinor: nullableMoney(draft.ratePerPostIls),
    ratePerStoryMinor: nullableMoney(draft.ratePerStoryIls),
  };
}

export function formatMediaKitCount(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('en').format(value);
}

function nullableText(value: string): string | null {
  return value.trim() || null;
}

function nullableInteger(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isInteger(number) ? number : null;
}

function nullableDecimal(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function nullableMoney(value: string): number | null {
  const amount = nullableDecimal(value);
  return amount === null ? null : Math.round(amount * 100);
}

function showNumber(value: number | null): string {
  return value === null ? '' : String(value);
}

function showMoney(value: number | null): string {
  return value === null ? '' : String(value / 100);
}
