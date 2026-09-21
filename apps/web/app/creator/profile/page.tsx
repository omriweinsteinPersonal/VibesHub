'use client';

import type {
  CategoryCard,
  CreatorProfileSettings,
  CreatorProfileSocialLink,
} from '@vibeshub/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';

import { apiRequest, publicApiCollectionRequest } from '../../../lib/api';
import { creatorConnectors } from '../../../lib/creator-connectors';
import {
  creatorImageAccept,
  deleteRecommendationImage,
  uploadCreatorImage,
} from '../../../lib/recommendation-media';

type UploadStage = 'idle' | 'authorizing' | 'uploading' | 'validating' | 'ready';
type SocialPlatform = CreatorProfileSocialLink['platform'];

interface EditorState {
  avatarAssetId: string;
  avatarUrl: string;
  bioHe: string;
  displayName: string;
  primaryCategoryId: string;
  socialUrls: Record<SocialPlatform, string>;
}

const emptySocialUrls: Record<SocialPlatform, string> = {
  facebook: '',
  instagram: '',
  linkedin: '',
  pinterest: '',
  tiktok: '',
  website: '',
  x: '',
  youtube: '',
};

export default function CreatorProfilePage() {
  const [profile, setProfile] = useState<CreatorProfileSettings | null>(null);
  const [categories, setCategories] = useState<CategoryCard[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const stagedAssetRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<CreatorProfileSettings>('/creator/profile'),
      publicApiCollectionRequest<CategoryCard>('/categories'),
    ])
      .then(([loadedProfile, categoryPage]) => {
        if (!active) return;
        setProfile(loadedProfile);
        setCategories(categoryPage.data);
        setEditor(toEditor(loadedProfile));
      })
      .catch((cause: unknown) => {
        if (active) setError(messageFor(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      const stagedAsset = stagedAssetRef.current;
      if (stagedAsset) void deleteRecommendationImage(stagedAsset).catch(() => undefined);
    };
  }, []);

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setEditor((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateSocial(platform: SocialPlatform, value: string) {
    setEditor((current) =>
      current
        ? { ...current, socialUrls: { ...current.socialUrls, [platform]: value } }
        : current,
    );
  }

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !editor) return;
    setError('');
    setNotice('');
    try {
      const asset = await uploadCreatorImage(file, setUploadStage);
      const previousStagedAsset = stagedAssetRef.current;
      stagedAssetRef.current = asset.id;
      setEditor((current) =>
        current
          ? { ...current, avatarAssetId: asset.id, avatarUrl: asset.publicUrl }
          : current,
      );
      if (previousStagedAsset) {
        await deleteRecommendationImage(previousStagedAsset).catch(() => undefined);
      }
      setUploadStage('ready');
      setNotice('Profile image uploaded. Save your profile to publish it.');
    } catch (cause) {
      setUploadStage('idle');
      setError(messageFor(cause));
    } finally {
      event.target.value = '';
    }
  }

  function removeImage() {
    if (!editor) return;
    const stagedAsset = stagedAssetRef.current;
    stagedAssetRef.current = null;
    if (stagedAsset) void deleteRecommendationImage(stagedAsset).catch(() => undefined);
    setEditor({ ...editor, avatarAssetId: '', avatarUrl: '' });
    setUploadStage('idle');
    setNotice('Profile image will be removed when you save.');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !editor) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const platformOrder = [
        ...profile.socialLinks.map(({ platform }) => platform),
        ...creatorConnectors
          .map(({ platform }) => platform)
          .filter((platform) => !profile.socialLinks.some((link) => link.platform === platform)),
      ];
      const socialLinks = platformOrder.flatMap((platform) => {
        const url = editor.socialUrls[platform].trim();
        const handle = profile.socialLinks.find((link) => link.platform === platform)?.handle;
        return url ? [{ handle: handle ?? null, platform, url }] : [];
      });
      const previousAvatarAssetId = profile.avatar?.assetId ?? null;
      const updated = await apiRequest<CreatorProfileSettings>('/creator/profile', {
        body: JSON.stringify({
          avatarAssetId: editor.avatarAssetId || null,
          bioHe: editor.bioHe,
          displayName: editor.displayName,
          primaryCategoryId: editor.primaryCategoryId,
          socialLinks,
        }),
        headers: { 'if-match': `"${profile.version}"` },
        method: 'PATCH',
      });
      stagedAssetRef.current = null;
      setProfile(updated);
      setEditor(toEditor(updated));
      setUploadStage(updated.avatar ? 'ready' : 'idle');
      setNotice('Your public storefront profile has been updated.');
      if (previousAvatarAssetId && previousAvatarAssetId !== updated.avatar?.assetId) {
        await deleteRecommendationImage(previousAvatarAssetId).catch(() => undefined);
      }
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  const imageIsUploading = ['authorizing', 'uploading', 'validating'].includes(
    uploadStage,
  );

  return (
    <main className="workspacePage">
      <header className="workspaceHeader creatorStudioHeader">
        <Link className="logo" href="/">
          <span>
            <Sparkles aria-hidden="true" size={16} />
          </span>{' '}
          Swave
        </Link>
        <nav aria-label="Creator studio navigation">
          <Link href="/account">Account</Link>
          <Link aria-current="page" href="/creator/profile">
            Profile
          </Link>
          <Link href="/creator/recommendations">Recommendations</Link>
          <Link href="/creator/discount-codes">Discount codes</Link>
          <Link href="/creator/analytics">Analytics</Link>
        </nav>
      </header>

      <section className="workspaceContent creatorProfileSettings">
        <div className="studioIntro">
          <div>
            <p className="eyebrow">CREATOR PROFILE</p>
            <h1>Edit your storefront identity</h1>
            <p className="workspaceLead">
              Keep your photo, expertise, Hebrew bio and public links current.
            </p>
          </div>
          {profile ? (
            <Link className="button secondary" href={`/creators/${profile.handle}`}>
              View storefront
            </Link>
          ) : null}
        </div>

        {error ? <p className="formError">{error}</p> : null}
        {notice ? <p className="formSuccess">{notice}</p> : null}
        {loading ? <div className="directoryState">Loading your profile…</div> : null}

        {profile && editor ? (
          <form className="applicationForm profileSettingsForm" onSubmit={save}>
            <section className="profilePhotoEditor" aria-labelledby="profile-photo-title">
              <div className="profilePhotoPreview">
                {editor.avatarUrl ? (
                  <Image
                    alt={`${editor.displayName} profile preview`}
                    fill
                    sizes="180px"
                    src={editor.avatarUrl}
                    unoptimized
                  />
                ) : (
                  <span aria-hidden="true">{initials(editor.displayName)}</span>
                )}
              </div>
              <div className="profilePhotoControls">
                <h2 id="profile-photo-title">Profile image</h2>
                <label className="button secondary profileUploadButton">
                  {imageIsUploading ? 'Uploading…' : 'Choose image'}
                  <input
                    accept={creatorImageAccept}
                    disabled={imageIsUploading || saving}
                    onChange={selectImage}
                    type="file"
                  />
                </label>
                {editor.avatarUrl ? (
                  <button
                    className="textButton"
                    disabled={imageIsUploading || saving}
                    onClick={removeImage}
                    type="button"
                  >
                    Remove image
                  </button>
                ) : null}
                <p className="fieldHint">JPEG, PNG or WebP, up to 5 MB.</p>
                {imageIsUploading ? (
                  <progress aria-label="Profile image upload progress" />
                ) : null}
              </div>
            </section>

            <div className="fieldGrid">
              <label>
                Creator display name
                <input
                  maxLength={100}
                  onChange={(event) => update('displayName', event.target.value)}
                  required
                  value={editor.displayName}
                />
              </label>
              <label>
                Storefront handle
                <input disabled readOnly value={`@${profile.handle}`} />
                <small className="fieldHint">
                  Handles stay fixed so shared storefront links do not break.
                </small>
              </label>
            </div>

            <label>
              Main expertise
              <select
                onChange={(event) => update('primaryCategoryId', event.target.value)}
                required
                value={editor.primaryCategoryId}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Bio in Hebrew
              <textarea
                dir="rtl"
                lang="he"
                maxLength={1000}
                onChange={(event) => update('bioHe', event.target.value)}
                required
                rows={5}
                value={editor.bioHe}
              />
              <small className="fieldHint">Up to 1,000 characters.</small>
            </label>

            <fieldset className="profileSocialFields">
              <legend>Public links</legend>
              <div className="fieldGrid">
                {creatorConnectors.map(({ label, placeholder, platform }) => (
                  <label key={platform}>
                    {label}
                    <input
                      onChange={(event) => updateSocial(platform, event.target.value)}
                      placeholder={placeholder}
                      type="url"
                      value={editor.socialUrls[platform]}
                    />
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              className="button primary studioSave"
              disabled={saving || imageIsUploading}
              type="submit"
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

function toEditor(profile: CreatorProfileSettings): EditorState {
  const socialUrls = { ...emptySocialUrls };
  for (const link of profile.socialLinks) socialUrls[link.platform] = link.url;
  return {
    avatarAssetId: profile.avatar?.assetId ?? '',
    avatarUrl: profile.avatar?.url ?? '',
    bioHe: profile.bioHe,
    displayName: profile.displayName,
    primaryCategoryId: profile.primaryCategory.id,
    socialUrls,
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function messageFor(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : 'The creator profile could not be saved.';
}
