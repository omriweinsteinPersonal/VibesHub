'use client';

import type {
  CategoryCard,
  CreatorMediaKit,
  CreatorMediaKitInput,
  CreatorProfileSettings,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Camera, Check, Copy, ExternalLink, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { ApiError, apiRequest, publicApiCollectionRequest } from '../../lib/api';
import { isCreatorHandle } from '../../lib/creator-handle';
import {
  creatorImageAccept,
  deleteRecommendationImage,
  uploadCreatorImage,
} from '../../lib/recommendation-media';
import { publicAssetUrl } from '../../lib/public-asset-url';
import {
  type CreatorHandleStatus,
  useCreatorHandleAvailability,
} from '../../lib/use-creator-handle-availability';
import { DelayedLoading } from './delayed-loading';
import { useCreatorNavigation } from './creator-navigation-provider';
import styles from './creator-account.module.css';

interface AccountSummary {
  capabilities: string[];
  creator: { handle: string; id: string } | null;
  email?: string;
}

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

export function CreatorAccount() {
  const router = useRouter();
  const { setCreatorProfile } = useCreatorNavigation();
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState<CreatorProfileSettings | null>(null);
  const [profileEditor, setProfileEditor] = useState<ProfileEditor | null>(null);
  const [mediaKit, setMediaKit] = useState<CreatorMediaKit | null>(null);
  const [mediaEditor, setMediaEditor] = useState<MediaKitEditor | null>(null);
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingMedia, setSavingMedia] = useState(false);
  const [editingMedia, setEditingMedia] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const stagedAssetRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [accountResult, profileResult, mediaKitResult, categoriesResult] =
        await Promise.allSettled([
          apiRequest<AccountSummary>('/me'),
          apiRequest<CreatorProfileSettings>('/creator/profile'),
          apiRequest<CreatorMediaKit>('/creator/studio/media-kit'),
          publicApiCollectionRequest<CategoryCard>('/categories'),
        ] as const);

      if (!active) return;
      if (accountResult.status === 'rejected') throw accountResult.reason;

      const account = accountResult.value;
      if (!account.creator) {
        const isPlatformOperator = account.capabilities.some((capability) =>
          ['admin:manage_platform', 'moderator:review_content'].includes(capability),
        );
        router.replace(isPlatformOperator ? '/admin/applications' : '/creator/apply');
        return;
      }

      const rejected = [profileResult, mediaKitResult, categoriesResult].find(
        (result) => result.status === 'rejected',
      );
      if (rejected?.status === 'rejected') throw rejected.reason;

      if (
        profileResult.status === 'fulfilled' &&
        mediaKitResult.status === 'fulfilled' &&
        categoriesResult.status === 'fulfilled'
      ) {
        const loadedProfile = profileResult.value;
        const loadedMediaKit = mediaKitResult.value;
        const categoryPage = categoriesResult.value;
        if (!active) return;
        setEmail(account.email ?? '');
        setProfile(loadedProfile);
        setProfileEditor(toProfileEditor(loadedProfile));
        setMediaKit(loadedMediaKit);
        setMediaEditor(toMediaKitEditor(loadedMediaKit));
        setCategories(categoryPage.data);
        setUploadStage(loadedProfile.avatar ? 'ready' : 'idle');
      }
    })().catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) {
        router.replace('/auth?mode=login&next=%2Faccount');
        return;
      }
      setError(messageFor(cause));
    });
    return () => {
      active = false;
      if (stagedAssetRef.current) {
        void deleteRecommendationImage(stagedAssetRef.current).catch(() => undefined);
      }
    };
  }, [router]);

  const handleStatus = useCreatorHandleAvailability({
    currentHandle: profile?.handle,
    endpoint: '/creator/profile/handle-availability',
    handle: profileEditor?.handle ?? '',
  });

  function updateProfile<K extends keyof ProfileEditor>(key: K, value: ProfileEditor[K]) {
    setProfileEditor((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateMedia<K extends keyof MediaKitEditor>(key: K, value: MediaKitEditor[K]) {
    setMediaEditor((current) => (current ? { ...current, [key]: value } : current));
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
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
      setSavingProfile(true);
      setNotice('Saving profile image…');
      try {
        const previousAvatarAssetId = profile.avatar?.assetId ?? null;
        const updated = await apiRequest<CreatorProfileSettings>('/creator/profile', {
          body: JSON.stringify({ avatarAssetId: asset.id }),
          headers: { 'if-match': `"${profile.version}"` },
          method: 'PATCH',
        });
        stagedAssetRef.current = null;
        setProfile(updated);
        setProfileEditor(toProfileEditor(updated));
        setCreatorProfile(updated);
        setUploadStage('ready');
        setNotice('Profile image is live on your storefront.');
        if (previousAvatarAssetId && previousAvatarAssetId !== updated.avatar?.assetId) {
          await deleteRecommendationImage(previousAvatarAssetId).catch(() => undefined);
        }
      } catch (cause) {
        setUploadStage('ready');
        setError(messageFor(cause));
        setNotice('Image uploaded. Save changes to publish it.');
      } finally {
        setSavingProfile(false);
      }
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
    if (!isCreatorHandle(profileEditor.handle) || handleStatus === 'unavailable') {
      setError('Choose an available storefront address before saving.');
      return;
    }
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
          handle: profileEditor.handle.trim(),
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
      setCreatorProfile(updated);
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
      setEditingMedia(false);
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

  async function copyPageLink() {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${encodeURIComponent(profile.handle)}`,
      );
      setError('');
      setNotice('Page link copied.');
    } catch {
      setError('Could not copy the link. Open your page to copy its address instead.');
    }
  }

  const publicHref = profile ? `/${encodeURIComponent(profile.handle)}` : '';
  const creatorHref = profile ? `/creator/${encodeURIComponent(profile.handle)}` : '';
  const instagram = profileEditor?.instagramUrl.trim() ?? '';

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>CREATOR STUDIO / ACCOUNT</p>
          <h1>Your account.</h1>
          <p>The details behind your page and your collaborations.</p>
        </div>
        {profile ? (
          <Link className={styles.outlineButton} href={publicHref}>
            <ExternalLink aria-hidden="true" size={16} /> View page
          </Link>
        ) : null}
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className={styles.success} role="status">
          {notice}
        </p>
      ) : null}
      {!profileEditor || !mediaEditor ? (
        <DelayedLoading>Opening your account…</DelayedLoading>
      ) : null}

      {profile && profileEditor && mediaKit && mediaEditor ? (
        <>
          <section className={styles.identity} aria-label="Your public identity">
            <Avatar name={profileEditor.displayName} url={profileEditor.avatarUrl} />
            <div className={styles.identityCopy}>
              <strong>{profileEditor.displayName || 'Your name'}</strong>
              <span>
                swavii.com/{profile.handle} <span aria-hidden="true">·</span>{' '}
                {profile.primaryCategory.name}
              </span>
            </div>
            <span className={styles.liveBadge}>Page is live</span>
          </section>
          <div className={styles.layout}>
            <div className={styles.stack}>
              <form className={styles.profileForm} onSubmit={saveProfile}>
                <section className={styles.card}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <h2>Public profile</h2>
                      <p>The essentials people see when they land on your page.</p>
                    </div>
                    <span className={styles.sectionTag}>PUBLIC</span>
                  </div>
                  <div className={styles.photoRow}>
                    <Avatar
                      name={profileEditor.displayName}
                      url={profileEditor.avatarUrl}
                    />
                    <div className={styles.photoCopy}>
                      <strong>Profile photo</strong>
                      <span>Visible on your page</span>
                    </div>
                    <div className={styles.photoActions}>
                      <label className={styles.photoUpload}>
                        <Upload aria-hidden="true" size={15} />
                        {imageIsUploading ? 'Uploading…' : 'Change photo'}
                        <input
                          accept={creatorImageAccept}
                          disabled={imageIsUploading || savingProfile}
                          onChange={selectImage}
                          type="file"
                        />
                      </label>
                      {profileEditor.avatarUrl ? (
                        <button
                          className={styles.removePhoto}
                          onClick={removeImage}
                          type="button"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.formGrid}>
                    <label className={styles.field}>
                      Display name
                      <input
                        maxLength={100}
                        required
                        value={profileEditor.displayName}
                        onChange={(event) =>
                          updateProfile('displayName', event.target.value)
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      Page address
                      <input
                        aria-describedby="account-handle-status"
                        dir="auto"
                        maxLength={100}
                        placeholder="yourname"
                        required
                        value={profileEditor.handle}
                        onChange={(event) => updateProfile('handle', event.target.value)}
                      />
                      <small
                        className={
                          handleStatus === 'unavailable' || handleStatus === 'invalid'
                            ? styles.invalidHint
                            : styles.fieldHint
                        }
                        id="account-handle-status"
                      >
                        {accountHandleMessage(handleStatus, profileEditor.handle)}
                      </small>
                    </label>
                    <label className={`${styles.field} ${styles.fullField}`}>
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
                    <label className={`${styles.field} ${styles.fullField}`}>
                      Bio
                      <textarea
                        dir="auto"
                        maxLength={1000}
                        rows={4}
                        value={profileEditor.bioHe}
                        onChange={(event) => updateProfile('bioHe', event.target.value)}
                      />
                    </label>
                  </div>
                </section>
                <section className={styles.card}>
                  <div className={styles.sectionHeading}>
                    <div>
                      <h2>Social presence</h2>
                      <p>Give people a way to keep up with you elsewhere.</p>
                    </div>
                    <span className={styles.sectionTag}>CONNECT</span>
                  </div>
                  <div className={styles.socialRow}>
                    <span className={styles.socialIcon}>
                      <Camera aria-hidden="true" size={17} />
                    </span>
                    <label className={styles.socialField}>
                      Instagram
                      <input
                        aria-label="Instagram link"
                        value={profileEditor.instagramUrl}
                        onChange={(event) =>
                          updateProfile('instagramUrl', event.target.value)
                        }
                        placeholder="@yourhandle or instagram.com/yourhandle"
                      />
                    </label>
                    {instagram ? (
                      <Check
                        aria-hidden="true"
                        className={styles.socialCheck}
                        size={18}
                      />
                    ) : null}
                  </div>
                  <Link className={styles.textLink} href={creatorHref}>
                    Manage all links in Storefront{' '}
                    <ArrowUpRight aria-hidden="true" size={16} />
                  </Link>
                </section>
                <div className={styles.saveRow}>
                  <span>Changes to your public profile appear after saving.</span>
                  <button
                    className={styles.primaryButton}
                    disabled={
                      savingProfile ||
                      imageIsUploading ||
                      handleStatus === 'checking' ||
                      handleStatus === 'invalid' ||
                      handleStatus === 'unavailable'
                    }
                    type="submit"
                  >
                    {savingProfile ? 'Saving…' : 'Save profile'}
                  </button>
                </div>
              </form>
              <section className={styles.card}>
                <div className={styles.sectionHeading}>
                  <div>
                    <h2>Media kit</h2>
                    <p>
                      Keep collaboration details organized, separate from your public
                      page.
                    </p>
                  </div>
                  <span className={styles.privateBadge}>Not on your public page</span>
                </div>
                <div className={styles.kitMetrics}>
                  <div>
                    <strong>{formatCount(mediaKit.followers)}</strong>
                    <span>Followers</span>
                  </div>
                  <div>
                    <strong>
                      {mediaKit.engagementRate === null
                        ? '—'
                        : `${mediaKit.engagementRate}%`}
                    </strong>
                    <span>Engagement</span>
                  </div>
                  <div>
                    <strong>{formatCount(mediaKit.averageStoryViews)}</strong>
                    <span>Avg. story views</span>
                  </div>
                </div>
                <div className={styles.kitFooter}>
                  <div className={styles.platforms}>
                    {mediaKit.platforms.length ? (
                      mediaKit.platforms.map((platform) => (
                        <span key={platform}>
                          {
                            platformOptions.find((option) => option.value === platform)
                              ?.label
                          }
                        </span>
                      ))
                    ) : (
                      <span>No platforms added</span>
                    )}
                  </div>
                  <button
                    aria-expanded={editingMedia}
                    className={styles.outlineButton}
                    onClick={() => setEditingMedia((current) => !current)}
                    type="button"
                  >
                    {editingMedia ? 'Close editor' : 'Edit media kit'}
                  </button>
                </div>
                {editingMedia ? (
                  <form className={styles.mediaForm} onSubmit={saveMediaKit}>
                    <p>
                      These details help brands understand your audience and collaboration
                      options.
                    </p>
                    <div className={styles.mediaGrid}>
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
                        updateMedia(
                          'contentTypes',
                          toggle(mediaEditor.contentTypes, value),
                        )
                      }
                    />
                    <div className={styles.mediaGrid}>
                      <label>
                        Booking email
                        <input
                          type="email"
                          value={mediaEditor.bookingEmail}
                          onChange={(event) =>
                            updateMedia('bookingEmail', event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Agent / agency name
                        <input
                          value={mediaEditor.agentAgencyName}
                          onChange={(event) =>
                            updateMedia('agentAgencyName', event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Agent email
                        <input
                          type="email"
                          value={mediaEditor.agentEmail}
                          onChange={(event) =>
                            updateMedia('agentEmail', event.target.value)
                          }
                        />
                      </label>
                      <label>
                        Agent phone
                        <input
                          type="tel"
                          value={mediaEditor.agentPhone}
                          onChange={(event) =>
                            updateMedia('agentPhone', event.target.value)
                          }
                        />
                      </label>
                    </div>
                    <button
                      className={styles.primaryButton}
                      disabled={savingMedia}
                      type="submit"
                    >
                      {savingMedia ? 'Saving…' : 'Save media kit'}
                    </button>
                  </form>
                ) : null}
              </section>
            </div>
            <aside className={styles.aside}>
              <section className={styles.card}>
                <p className={styles.asideEyebrow}>YOUR PAGE, AT A GLANCE</p>
                <div className={styles.preview}>
                  <div className={styles.previewTop}>
                    <Avatar
                      name={profileEditor.displayName}
                      url={profileEditor.avatarUrl}
                    />
                    <strong>{profileEditor.displayName || 'Your name'}</strong>
                    <small>
                      {categories.find(
                        (category) => category.id === profileEditor.primaryCategoryId,
                      )?.name ?? profile.primaryCategory.name}
                    </small>
                  </div>
                  <div className={styles.previewBody}>
                    <p>{profileEditor.bioHe || 'Your bio will appear here.'}</p>
                    {instagram ? (
                      <div className={styles.previewLink}>
                        Instagram <ArrowUpRight aria-hidden="true" size={14} />
                      </div>
                    ) : null}
                    <span className={styles.previewCaption}>
                      More of your page lives in Storefront
                    </span>
                  </div>
                </div>
                <div className={styles.previewActions}>
                  <button
                    className={styles.outlineButton}
                    onClick={copyPageLink}
                    type="button"
                  >
                    <Copy aria-hidden="true" size={15} /> Copy link
                  </button>
                  <Link className={styles.outlineButton} href={creatorHref}>
                    Open storefront
                  </Link>
                </div>
              </section>
              <section className={styles.card}>
                <div className={styles.sectionHeading}>
                  <div>
                    <h2>Account access</h2>
                    <p>Private sign-in details for your Swavii account.</p>
                  </div>
                </div>
                <div className={styles.accessRow}>
                  <span>
                    <strong>Email</strong>
                    <small>{email || 'No email available'}</small>
                  </span>
                </div>
                <div className={styles.accessRow}>
                  <span>
                    <strong>Password</strong>
                    <small>Keep your account secure</small>
                  </span>
                  <Link href={`/auth/reset-password?email=${encodeURIComponent(email)}`}>
                    Reset
                  </Link>
                </div>
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </main>
  );
}

function Avatar({ name, url }: { name: string; url: string }) {
  return (
    <span className={styles.avatar}>
      {url ? (
        <Image alt="" fill sizes="64px" src={publicAssetUrl(url)} unoptimized />
      ) : (
        <b>{initials(name)}</b>
      )}
    </span>
  );
}

function formatCount(value: number | null): string {
  if (value === null) return '—';
  if (value >= 10_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return new Intl.NumberFormat('en-US').format(value);
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
    <label className={styles.field}>
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
    <fieldset className={styles.choiceGroup}>
      <legend>{label}</legend>
      <div>
        {options.map((option) => (
          <button
            aria-pressed={selected.includes(option.value)}
            className={selected.includes(option.value) ? styles.choiceActive : ''}
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

function accountHandleMessage(status: CreatorHandleStatus, handle: string): string {
  if (status === 'checking') return 'Checking address availability…';
  if (status === 'unavailable') return 'That address is already taken.';
  if (status === 'invalid')
    return 'Use 2–100 characters without /, ?, #, %, or backslashes.';
  return `Public address: swavii.com/${handle}`;
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
