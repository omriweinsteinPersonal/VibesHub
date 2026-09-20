'use client';

import type {
  CategoryCard,
  CreatorMediaKit,
  CreatorMediaKitInput,
  CreatorProfileSettings,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { apiRequest, publicApiCollectionRequest } from '../../lib/api';
import {
  creatorImageAccept,
  deleteRecommendationImage,
  uploadCreatorImage,
} from '../../lib/recommendation-media';
import { publicAssetUrl } from '../../lib/public-asset-url';
import { CreatorShellHeader } from './creator-shell-header';
import { SiteFooter } from './site-footer';

type UploadStage = 'idle' | 'authorizing' | 'uploading' | 'validating' | 'ready';
type Platform = CreatorMediaKit['platforms'][number];
type ContentType = CreatorMediaKit['contentTypes'][number];

interface ProfileEditor {
  avatarAssetId: string;
  avatarUrl: string;
  bioHe: string;
  displayName: string;
  handle: string;
  instagramUrl: string;
  primaryCategoryId: string;
}

interface MediaKitEditor {
  agentAgencyName: string;
  agentEmail: string;
  agentPhone: string;
  audienceAgeFrom: string;
  audienceAgeTo: string;
  audienceGender: CreatorMediaKit['audienceGender'];
  audienceLocation: string;
  averageReelViews: string;
  averageStoryViews: string;
  bookingEmail: string;
  contentTypes: ContentType[];
  engagementRate: string;
  followers: string;
  platforms: Platform[];
  ratePerPostIls: string;
  ratePerStoryIls: string;
}

const platformOptions: Array<{ label: string; value: Platform }> = [
  { label: 'Instagram', value: 'instagram' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'YouTube', value: 'youtube' },
];

const contentTypeOptions: Array<{ label: string; value: ContentType }> = [
  { label: 'Stories', value: 'stories' },
  { label: 'Reels', value: 'reels' },
  { label: 'Posts', value: 'posts' },
];

export function CreatorAccount({ email }: { email?: string }) {
  const [profile, setProfile] = useState<CreatorProfileSettings | null>(null);
  const [profileEditor, setProfileEditor] = useState<ProfileEditor | null>(null);
  const [mediaKit, setMediaKit] = useState<CreatorMediaKit | null>(null);
  const [mediaEditor, setMediaEditor] = useState<MediaKitEditor | null>(null);
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const stagedAssetRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<CreatorProfileSettings>('/creator/profile'),
      apiRequest<CreatorMediaKit>('/creator/studio/media-kit'),
      publicApiCollectionRequest<CategoryCard>('/categories'),
    ])
      .then(([loadedProfile, loadedMediaKit, categoryPage]) => {
        if (!active) return;
        setProfile(loadedProfile);
        setProfileEditor(toProfileEditor(loadedProfile));
        setMediaKit(loadedMediaKit);
        setMediaEditor(toMediaKitEditor(loadedMediaKit));
        setCategories(categoryPage.data);
        setUploadStage(loadedProfile.avatar ? 'ready' : 'idle');
      })
      .catch((cause: unknown) => active && setError(messageFor(cause)));
    return () => {
      active = false;
      if (stagedAssetRef.current) {
        void deleteRecommendationImage(stagedAssetRef.current).catch(() => undefined);
      }
    };
  }, []);

  function updateProfile<K extends keyof ProfileEditor>(key: K, value: ProfileEditor[K]) {
    setProfileEditor((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateMedia<K extends keyof MediaKitEditor>(key: K, value: MediaKitEditor[K]) {
    setMediaEditor((current) => (current ? { ...current, [key]: value } : current));
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setNotice('');
    try {
      const asset = await uploadCreatorImage(file, setUploadStage);
      const previous = stagedAssetRef.current;
      stagedAssetRef.current = asset.id;
      setProfileEditor((current) =>
        current
          ? { ...current, avatarAssetId: asset.id, avatarUrl: asset.publicUrl }
          : current,
      );
      if (previous) await deleteRecommendationImage(previous).catch(() => undefined);
      setUploadStage('ready');
      setNotice('Profile photo uploaded. Save changes to publish it.');
    } catch (cause) {
      setUploadStage('idle');
      setError(messageFor(cause));
    } finally {
      event.target.value = '';
    }
  }

  function removeImage() {
    const staged = stagedAssetRef.current;
    stagedAssetRef.current = null;
    if (staged) void deleteRecommendationImage(staged).catch(() => undefined);
    setProfileEditor((current) =>
      current ? { ...current, avatarAssetId: '', avatarUrl: '' } : current,
    );
    setUploadStage('idle');
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !profileEditor) return;
    setSavingProfile(true);
    setError('');
    setNotice('');
    try {
      const otherLinks = profile.socialLinks.filter(
        ({ platform }) => platform !== 'instagram',
      );
      const instagramUrl = normalizeInstagram(profileEditor.instagramUrl);
      const previousAvatarAssetId = profile.avatar?.assetId ?? null;
      const updated = await apiRequest<CreatorProfileSettings>('/creator/profile', {
        body: JSON.stringify({
          avatarAssetId: profileEditor.avatarAssetId || null,
          bioHe: profileEditor.bioHe,
          displayName: profileEditor.displayName,
          handle: profileEditor.handle.trim().toLowerCase(),
          primaryCategoryId: profileEditor.primaryCategoryId,
          socialLinks: instagramUrl
            ? [...otherLinks, { platform: 'instagram', url: instagramUrl }]
            : otherLinks,
        }),
        headers: { 'if-match': `"${profile.version}"` },
        method: 'PATCH',
      });
      stagedAssetRef.current = null;
      setProfile(updated);
      setProfileEditor(toProfileEditor(updated));
      setNotice('Your profile changes are live.');
      if (previousAvatarAssetId && previousAvatarAssetId !== updated.avatar?.assetId) {
        await deleteRecommendationImage(previousAvatarAssetId).catch(() => undefined);
      }
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveMediaKit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mediaKit || !mediaEditor) return;
    setSavingMedia(true);
    setError('');
    setNotice('');
    try {
      const input: CreatorMediaKitInput = {
        agentAgencyName: nullableText(mediaEditor.agentAgencyName),
        agentEmail: nullableText(mediaEditor.agentEmail),
        agentPhone: nullableText(mediaEditor.agentPhone),
        audienceAgeFrom: nullableInteger(mediaEditor.audienceAgeFrom),
        audienceAgeTo: nullableInteger(mediaEditor.audienceAgeTo),
        audienceGender: mediaEditor.audienceGender,
        audienceLocation: nullableText(mediaEditor.audienceLocation),
        averageReelViews: nullableInteger(mediaEditor.averageReelViews),
        averageStoryViews: nullableInteger(mediaEditor.averageStoryViews),
        bookingEmail: nullableText(mediaEditor.bookingEmail),
        contentTypes: mediaEditor.contentTypes,
        engagementRate: nullableDecimal(mediaEditor.engagementRate),
        followers: nullableInteger(mediaEditor.followers),
        platforms: mediaEditor.platforms,
        ratePerPostMinor: nullableMoney(mediaEditor.ratePerPostIls),
        ratePerStoryMinor: nullableMoney(mediaEditor.ratePerStoryIls),
      };
      const updated = await apiRequest<CreatorMediaKit>('/creator/studio/media-kit', {
        body: JSON.stringify(input),
        headers: { 'if-match': `"${mediaKit.version}"` },
        method: 'PUT',
      });
      setMediaKit(updated);
      setMediaEditor(toMediaKitEditor(updated));
      setNotice('Your media kit has been updated.');
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSavingMedia(false);
    }
  }

  const imageIsUploading = ['authorizing', 'uploading', 'validating'].includes(
    uploadStage,
  );

  return (
    <div className="creatorShellPage">
      <CreatorShellHeader />
      <main className="creatorAccountMain">
        <header className="creatorAccountHeading">
          <div>
            <h1>Your account</h1>
            <p>{email}</p>
          </div>
          <div className="creatorAccountHeadingActions">
            <span>Creator</span>
            <Link className="button primary" href="/dashboard">
              Creator dashboard
            </Link>
          </div>
        </header>

        {error ? <p className="formError">{error}</p> : null}
        {notice ? <p className="formSuccess">{notice}</p> : null}
        {!profileEditor || !mediaEditor ? (
          <div className="creatorLoading">Opening your account…</div>
        ) : null}

        {profile && profileEditor ? (
          <form className="creatorAccountCard" onSubmit={saveProfile}>
            <h2>Profile</h2>
            <section className="creatorAccountPhoto">
              <span className="creatorAccountAvatar">
                {profileEditor.avatarUrl ? (
                  <Image
                    alt=""
                    fill
                    sizes="96px"
                    src={publicAssetUrl(profileEditor.avatarUrl)}
                    unoptimized
                  />
                ) : (
                  <b>{initials(profileEditor.displayName)}</b>
                )}
              </span>
              <div>
                <strong>Profile photo</strong>
                <div className="creatorPhotoActions">
                  <label className="button secondary">
                    <Upload aria-hidden="true" size={16} />
                    {imageIsUploading ? 'Uploading…' : 'Change photo'}
                    <input
                      accept={creatorImageAccept}
                      disabled={imageIsUploading || savingProfile}
                      onChange={selectImage}
                      type="file"
                    />
                  </label>
                  {profileEditor.avatarUrl ? (
                    <button className="textButton" onClick={removeImage} type="button">
                      Remove
                    </button>
                  ) : null}
                </div>
                <small>Shown at the top of your storefront.</small>
              </div>
            </section>
            <label>
              Display name
              <input
                maxLength={100}
                required
                value={profileEditor.displayName}
                onChange={(event) => updateProfile('displayName', event.target.value)}
              />
            </label>
            <label>
              Storefront handle
              <input
                maxLength={40}
                pattern="[a-z0-9][a-z0-9-]*"
                required
                value={profileEditor.handle}
                onChange={(event) =>
                  updateProfile('handle', event.target.value.toLowerCase())
                }
              />
            </label>
            <Link className="creatorInlineLink" href={`/creator/${profile.handle}`}>
              View your storefront
            </Link>
            <label>
              Main category
              <select
                required
                value={profileEditor.primaryCategoryId}
                onChange={(event) =>
                  updateProfile('primaryCategoryId', event.target.value)
                }
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Instagram link
              <input
                value={profileEditor.instagramUrl}
                onChange={(event) => updateProfile('instagramUrl', event.target.value)}
                placeholder="@yourhandle or instagram.com/yourhandle"
              />
            </label>
            <small>Shown as a “Follow on Instagram” button on your storefront.</small>
            <label>
              Bio (Hebrew)
              <textarea
                dir="rtl"
                lang="he"
                maxLength={1000}
                required
                rows={4}
                value={profileEditor.bioHe}
                onChange={(event) => updateProfile('bioHe', event.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={savingProfile || imageIsUploading}
              type="submit"
            >
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        ) : null}

        {mediaKit && mediaEditor ? (
          <form className="creatorAccountCard creatorMediaKit" onSubmit={saveMediaKit}>
            <h2>Media kit</h2>
            <p>
              Brands running campaigns on Swave match against these numbers. The more you
              fill in, the more campaigns you&apos;ll appear in.
            </p>
            <div className="creatorFormGrid">
              <NumberField
                label="Followers"
                value={mediaEditor.followers}
                onChange={(value) => updateMedia('followers', value)}
              />
              <NumberField
                label="Engagement rate (%)"
                value={mediaEditor.engagementRate}
                onChange={(value) => updateMedia('engagementRate', value)}
                step="0.01"
              />
              <NumberField
                label="Average story views"
                value={mediaEditor.averageStoryViews}
                onChange={(value) => updateMedia('averageStoryViews', value)}
              />
              <NumberField
                label="Average reel views"
                value={mediaEditor.averageReelViews}
                onChange={(value) => updateMedia('averageReelViews', value)}
              />
              <NumberField
                label="Audience age from"
                value={mediaEditor.audienceAgeFrom}
                onChange={(value) => updateMedia('audienceAgeFrom', value)}
              />
              <NumberField
                label="Audience age to"
                value={mediaEditor.audienceAgeTo}
                onChange={(value) => updateMedia('audienceAgeTo', value)}
              />
              <NumberField
                label="Rate per post (₪)"
                value={mediaEditor.ratePerPostIls}
                onChange={(value) => updateMedia('ratePerPostIls', value)}
                step="0.01"
              />
              <NumberField
                label="Rate per story (₪)"
                value={mediaEditor.ratePerStoryIls}
                onChange={(value) => updateMedia('ratePerStoryIls', value)}
                step="0.01"
              />
              <label>
                Audience gender
                <select
                  value={mediaEditor.audienceGender ?? 'not_specified'}
                  onChange={(event) =>
                    updateMedia(
                      'audienceGender',
                      event.target.value as CreatorMediaKit['audienceGender'],
                    )
                  }
                >
                  <option value="not_specified">Not specified</option>
                  <option value="female">Mostly women</option>
                  <option value="male">Mostly men</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
              <label>
                Audience location
                <input
                  value={mediaEditor.audienceLocation}
                  onChange={(event) =>
                    updateMedia('audienceLocation', event.target.value)
                  }
                  placeholder="Israel"
                />
              </label>
            </div>
            <ChoiceGroup
              label="Platforms"
              options={platformOptions}
              selected={mediaEditor.platforms}
              onToggle={(value) =>
                updateMedia('platforms', toggle(mediaEditor.platforms, value))
              }
            />
            <ChoiceGroup
              label="Content types"
              options={contentTypeOptions}
              selected={mediaEditor.contentTypes}
              onToggle={(value) =>
                updateMedia('contentTypes', toggle(mediaEditor.contentTypes, value))
              }
            />
            <div className="creatorFormGrid">
              <label>
                Booking email
                <input
                  type="email"
                  value={mediaEditor.bookingEmail}
                  onChange={(event) => updateMedia('bookingEmail', event.target.value)}
                />
              </label>
              <label>
                Agent / agency name
                <input
                  value={mediaEditor.agentAgencyName}
                  onChange={(event) => updateMedia('agentAgencyName', event.target.value)}
                />
              </label>
              <label>
                Agent email
                <input
                  type="email"
                  value={mediaEditor.agentEmail}
                  onChange={(event) => updateMedia('agentEmail', event.target.value)}
                />
              </label>
              <label>
                Agent phone
                <input
                  type="tel"
                  value={mediaEditor.agentPhone}
                  onChange={(event) => updateMedia('agentPhone', event.target.value)}
                />
              </label>
            </div>
            <button className="button primary" disabled={savingMedia} type="submit">
              {savingMedia ? 'Saving…' : 'Save media kit'}
            </button>
          </form>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}

function NumberField({
  label,
  onChange,
  step = '1',
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  step?: string;
  value: string;
}) {
  return (
    <label>
      {label}
      <input
        min="0"
        onChange={(event) => onChange(event.target.value)}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

function ChoiceGroup<T extends string>({
  label,
  onToggle,
  options,
  selected,
}: {
  label: string;
  onToggle: (value: T) => void;
  options: Array<{ label: string; value: T }>;
  selected: T[];
}) {
  return (
    <fieldset className="creatorChoiceGroup">
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            aria-pressed={selected.includes(option.value)}
            className={selected.includes(option.value) ? 'active' : ''}
            key={option.value}
            onClick={() => onToggle(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function toProfileEditor(profile: CreatorProfileSettings): ProfileEditor {
  return {
    avatarAssetId: profile.avatar?.assetId ?? '',
    avatarUrl: profile.avatar?.url ?? '',
    bioHe: profile.bioHe,
    displayName: profile.displayName,
    handle: profile.handle,
    instagramUrl:
      profile.socialLinks.find(({ platform }) => platform === 'instagram')?.url ?? '',
    primaryCategoryId: profile.primaryCategory.id,
  };
}

function toMediaKitEditor(mediaKit: CreatorMediaKit): MediaKitEditor {
  return {
    agentAgencyName: mediaKit.agentAgencyName ?? '',
    agentEmail: mediaKit.agentEmail ?? '',
    agentPhone: mediaKit.agentPhone ?? '',
    audienceAgeFrom: show(mediaKit.audienceAgeFrom),
    audienceAgeTo: show(mediaKit.audienceAgeTo),
    audienceGender: mediaKit.audienceGender ?? 'not_specified',
    audienceLocation: mediaKit.audienceLocation ?? 'Israel',
    averageReelViews: show(mediaKit.averageReelViews),
    averageStoryViews: show(mediaKit.averageStoryViews),
    bookingEmail: mediaKit.bookingEmail ?? '',
    contentTypes: mediaKit.contentTypes,
    engagementRate: show(mediaKit.engagementRate),
    followers: show(mediaKit.followers),
    platforms: mediaKit.platforms,
    ratePerPostIls: showMoney(mediaKit.ratePerPostMinor),
    ratePerStoryIls: showMoney(mediaKit.ratePerStoryMinor),
  };
}

function normalizeInstagram(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('@')) return `https://www.instagram.com/${trimmed.slice(1)}`;
  if (/^instagram\.com\//i.test(trimmed)) return `https://www.${trimmed}`;
  return trimmed;
}

function nullableText(value: string): string | null {
  return value.trim() || null;
}
function nullableInteger(value: string): number | null {
  return value === '' ? null : Math.round(Number(value));
}
function nullableDecimal(value: string): number | null {
  return value === '' ? null : Number(value);
}
function nullableMoney(value: string): number | null {
  return value === '' ? null : Math.round(Number(value) * 100);
}
function show(value: number | null): string {
  return value === null ? '' : String(value);
}
function showMoney(value: number | null): string {
  return value === null ? '' : String(value / 100);
}
function initials(value: string): string {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Your account could not be updated.';
}
