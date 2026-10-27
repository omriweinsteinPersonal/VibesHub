'use client';

import type { CreatorProfileSettings } from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { ApiError, apiRequest } from '../../lib/api';
import { getSupabaseBrowserClient } from '../../lib/supabase-browser';
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
interface ProfileEditor {
  avatarAssetId: string;
  avatarUrl: string;
  bioHe: string;
  displayName: string;
  handle: string;
  instagramUrl: string;
}

export function CreatorAccount() {
  const router = useRouter();
  const { clearStorefrontHref, setCreatorProfile } = useCreatorNavigation();
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState<CreatorProfileSettings | null>(null);
  const [profileEditor, setProfileEditor] = useState<ProfileEditor | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const stagedAssetRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [accountResult, profileResult] = await Promise.allSettled([
        apiRequest<AccountSummary>('/me'),
        apiRequest<CreatorProfileSettings>('/creator/profile'),
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

      if (profileResult.status === 'rejected') throw profileResult.reason;

      if (profileResult.status === 'fulfilled') {
        const loadedProfile = profileResult.value;
        if (!active) return;
        setEmail(account.email ?? '');
        setProfile(loadedProfile);
        setProfileEditor(toProfileEditor(loadedProfile));
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

  const imageIsUploading = ['authorizing', 'uploading', 'validating'].includes(
    uploadStage,
  );

  async function signOut() {
    setSigningOut(true);
    try {
      const auth = getSupabaseBrowserClient().auth as unknown as {
        signOut: () => Promise<unknown>;
      };
      await auth.signOut();
      clearStorefrontHref();
      router.replace('/');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>CREATOR STUDIO / ACCOUNT</p>
          <h1>Your account.</h1>
          <p>The details behind your public page and account access.</p>
          <Link href="/account/subscription">Subscription details</Link>
        </div>
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
      {!profileEditor ? <DelayedLoading>Opening your account…</DelayedLoading> : null}

      {profile && profileEditor ? (
        <>
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
            </div>
          </div>
          <button
            className={styles.logoutButton}
            disabled={signingOut}
            onClick={() => void signOut()}
            type="button"
          >
            <LogOut aria-hidden="true" size={16} />
            {signingOut ? 'Signing out…' : 'Log out'}
          </button>
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

function toProfileEditor(profile: CreatorProfileSettings): ProfileEditor {
  return {
    avatarAssetId: profile.avatar?.assetId ?? '',
    avatarUrl: profile.avatar?.url ?? '',
    bioHe: profile.bioHe,
    displayName: profile.displayName,
    handle: profile.handle,
    instagramUrl:
      profile.socialLinks.find(({ platform }) => platform === 'instagram')?.url ?? '',
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
