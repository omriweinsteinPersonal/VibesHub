'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

import { apiRequest, publicApiRequest } from '../../../lib/api';
import {
  isCreatorHandle,
  normalizeCreatorHandle,
  suggestCreatorHandle,
} from '../../../lib/creator-handle';
import {
  type CreatorHandleStatus,
  useCreatorHandleAvailability,
} from '../../../lib/use-creator-handle-availability';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface CreatorApplication {
  bioText: string | null;
  displayName: string | null;
  feedback: Array<{ createdAt: string; decision: string; publicMessage: string }>;
  id: string;
  primaryCategoryId: string | null;
  requestedHandle: string | null;
  socialLinks: Array<{ followerCount?: number | null; platform: string; url: string }>;
  status: string;
}

export default function CreatorApplicationPage() {
  const router = useRouter();
  const [application, setApplication] = useState<CreatorApplication | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [requestedHandle, setRequestedHandle] = useState('');
  const [handleEdited, setHandleEdited] = useState(false);
  const [bioText, setBioText] = useState('');
  const [primaryCategoryId, setPrimaryCategoryId] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [followerCount, setFollowerCount] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([
      publicApiRequest<Category[]>('/categories'),
      apiRequest<CreatorApplication | null>('/creator-applications/current'),
    ])
      .then(([loadedCategories, current]) => {
        setCategories(loadedCategories);
        setApplication(current);
        if (current) {
          setDisplayName(current.displayName ?? '');
          setRequestedHandle(current.requestedHandle ?? '');
          setHandleEdited(Boolean(current.requestedHandle));
          setBioText(current.bioText ?? '');
          setPrimaryCategoryId(current.primaryCategoryId ?? '');
          const instagram = current.socialLinks.find(
            (link) => link.platform === 'instagram',
          );
          setInstagramUrl(instagram?.url ?? '');
          setFollowerCount(instagram?.followerCount?.toString() ?? '');
        }
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : 'Could not load the application.',
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const handleStatus = useCreatorHandleAvailability({
    currentHandle: application?.requestedHandle,
    endpoint: '/creator-applications/handle-availability',
    handle: requestedHandle,
  });

  const editable =
    !application || ['draft', 'changes_requested'].includes(application.status);
  const latestFeedback = application?.feedback.at(-1);

  async function saveAndSubmit(event: FormEvent) {
    event.preventDefault();
    const handle = normalizeCreatorHandle(
      requestedHandle || suggestCreatorHandle(displayName),
    );
    if (
      !isCreatorHandle(handle) ||
      handleStatus === 'invalid' ||
      handleStatus === 'unavailable'
    ) {
      setError('Choose an available storefront address before continuing.');
      return;
    }
    setError('');
    setMessage('');
    setLoading(true);
    const payload = {
      bioText,
      displayName,
      primaryCategoryId,
      requestedHandle: handle,
      socialLinks: [
        {
          followerCount: followerCount ? Number(followerCount) : null,
          platform: 'instagram',
          url: instagramUrl,
        },
      ],
    };
    try {
      const draft = application
        ? await apiRequest<CreatorApplication>(
            `/creator-applications/${application.id}`,
            {
              body: JSON.stringify(payload),
              method: 'PATCH',
            },
          )
        : await apiRequest<CreatorApplication>('/creator-applications', {
            body: JSON.stringify(payload),
            idempotent: true,
            method: 'POST',
          });
      const submitted = await apiRequest<CreatorApplication>(
        `/creator-applications/${draft.id}/submit`,
        { idempotent: true, method: 'POST' },
      );
      setApplication(submitted);
      setMessage('Your creator storefront is ready.');
      router.push('/creator-home');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not submit the application.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="workspacePage">
      <header className="workspaceHeader">
        <Link className="logo" href="/">
          <span>
            <Sparkles aria-hidden="true" size={16} />
          </span>{' '}
          swavii
        </Link>
        <Link href="/account">Account</Link>
      </header>
      <section className="workspaceContent narrow">
        <p className="eyebrow">CREATOR APPLICATION</p>
        <h1>Open your swavii storefront</h1>
        <p className="workspaceLead">
          Tell us who you are and where your community follows you. Your creator
          storefront will open immediately.
        </p>
        {application && !editable ? (
          <div className="statusBanner">
            Application status: <strong>{application.status.replaceAll('_', ' ')}</strong>
          </div>
        ) : null}
        {latestFeedback ? (
          <div className="statusBanner" role="status">
            <strong>Message from the swavii review team</strong>
            <p>{latestFeedback.publicMessage}</p>
          </div>
        ) : null}
        {loading && !application ? <p>Loading…</p> : null}
        <form className="applicationForm" onSubmit={saveAndSubmit}>
          <div className="fieldGrid">
            <label>
              Creator display name
              <input
                disabled={!editable}
                maxLength={100}
                onChange={(event) => {
                  const value = event.target.value;
                  setDisplayName(value);
                  if (!handleEdited) setRequestedHandle(suggestCreatorHandle(value));
                }}
                required
                value={displayName}
              />
            </label>
            <label>
              Storefront handle
              <input
                aria-describedby="storefront-handle-status"
                disabled={!editable}
                maxLength={30}
                onChange={(event) => {
                  setHandleEdited(true);
                  setRequestedHandle(normalizeCreatorHandle(event.target.value));
                }}
                pattern="[a-z0-9][a-z0-9_-]{1,29}"
                required
                value={requestedHandle}
              />
              <small className="fieldHint" id="storefront-handle-status">
                {handleMessage(handleStatus, requestedHandle)}
              </small>
            </label>
          </div>
          <label>
            Main category
            <select
              disabled={!editable}
              onChange={(event) => setPrimaryCategoryId(event.target.value)}
              required
              value={primaryCategoryId}
            >
              <option value="">Choose a category</option>
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
              disabled={!editable}
              lang="he"
              maxLength={1000}
              onChange={(event) => setBioText(event.target.value)}
              required
              rows={5}
              value={bioText}
            />
          </label>
          <div className="fieldGrid">
            <label>
              Instagram profile URL
              <input
                disabled={!editable}
                onChange={(event) => setInstagramUrl(event.target.value)}
                required
                type="url"
                value={instagramUrl}
              />
            </label>
            <label>
              Approximate followers
              <input
                disabled={!editable}
                min={0}
                onChange={(event) => setFollowerCount(event.target.value)}
                type="number"
                value={followerCount}
              />
            </label>
          </div>
          {error ? <p className="formError">{error}</p> : null}
          {message ? <p className="formSuccess">{message}</p> : null}
          {editable ? (
            <button
              className="button primary formSubmit"
              disabled={
                loading ||
                handleStatus === 'checking' ||
                handleStatus === 'invalid' ||
                handleStatus === 'unavailable'
              }
              type="submit"
            >
              {loading ? 'Creating storefront…' : 'Create creator storefront'}
            </button>
          ) : null}
        </form>
      </section>
    </main>
  );
}

function handleMessage(status: CreatorHandleStatus, handle: string): string {
  if (!handle) return 'This becomes your public address on swavii.';
  if (status === 'checking') return 'Checking address availability…';
  if (status === 'available') return `swavii.com/${handle} is available`;
  if (status === 'unavailable') return 'That address is already taken.';
  if (status === 'invalid') return 'Use 2–30 lowercase letters, numbers, - or _.';
  return `Your page will live at swavii.com/${handle}`;
}
