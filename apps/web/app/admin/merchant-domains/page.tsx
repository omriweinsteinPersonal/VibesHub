'use client';

import type {
  MerchantDomainReviewItem,
  MerchantDomainReviewStatus,
} from '@vibeshub/contracts';
import Link from 'next/link';
import { ExternalLink, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { apiCollectionRequest, apiRequest } from '../../../lib/api';

const statuses: MerchantDomainReviewStatus[] = [
  'pending',
  'approved',
  'rejected',
  'disabled',
];

export default function AdminMerchantDomainsPage() {
  const [status, setStatus] = useState<MerchantDomainReviewStatus>('pending');
  const [domains, setDomains] = useState<MerchantDomainReviewItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [importPermissions, setImportPermissions] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    void apiCollectionRequest<MerchantDomainReviewItem>(
      `/admin/merchant-domains?status=${status}&limit=20`,
    )
      .then((page) => {
        if (!active) return;
        setDomains(page.data);
        setNextCursor(page.page.nextCursor);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setDomains([]);
        setNextCursor(null);
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load the merchant-domain queue.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status]);

  function selectStatus(option: MerchantDomainReviewStatus) {
    if (option === status) return;
    setDomains([]);
    setNextCursor(null);
    setError('');
    setSuccess('');
    setLoading(true);
    setStatus(option);
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    setError('');
    try {
      const page = await apiCollectionRequest<MerchantDomainReviewItem>(
        `/admin/merchant-domains?status=${status}&limit=20&cursor=${encodeURIComponent(nextCursor)}`,
      );
      setDomains((current) => [...current, ...page.data]);
      setNextCursor(page.page.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load more domains.');
    } finally {
      setLoading(false);
    }
  }

  async function decide(
    domain: MerchantDomainReviewItem,
    command: 'approve' | 'disable' | 'reject',
  ) {
    const note = notes[domain.id]?.trim() ?? '';
    if (command !== 'approve' && !note) {
      setError(`Add an internal reason before you ${command} this domain.`);
      return;
    }

    setBusyId(domain.id);
    setError('');
    setSuccess('');
    try {
      const body =
        command === 'approve'
          ? {
              allowImport: importPermissions[domain.id] ?? false,
              allowRedirect: true,
              note: note || null,
            }
          : { note };
      await apiRequest<MerchantDomainReviewItem>(
        `/admin/merchant-domains/${domain.id}/${command}`,
        {
          body: JSON.stringify(body),
          headers: { 'if-match': String(domain.version) },
          idempotent: true,
          method: 'POST',
        },
      );
      setDomains((current) => current.filter((item) => item.id !== domain.id));
      setSuccess(`${domain.hostname} was ${pastTense(command)}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The review action failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="workspacePage">
      <header className="workspaceHeader adminWorkspaceHeader">
        <Link className="logo" href="/">
          <span>
            <Sparkles aria-hidden="true" size={16} />
          </span>{' '}
          Swave
        </Link>
        <nav aria-label="Administration">
          <Link href="/admin/applications">Creator applications</Link>
          <Link href="/account">Account</Link>
        </nav>
      </header>
      <section className="workspaceContent merchantDomainWorkspace">
        <p className="eyebrow">PLATFORM OPERATIONS</p>
        <h1>Merchant-domain reviews</h1>
        <p className="workspaceLead">
          Review exact hostnames before Swave imports product data or redirects a shopper.
          Approval never comes from creator-supplied content.
        </p>

        <div className="domainQueueTabs" role="group" aria-label="Review status">
          {statuses.map((option) => (
            <button
              aria-pressed={status === option}
              className={status === option ? 'active' : ''}
              key={option}
              onClick={() => selectStatus(option)}
              type="button"
            >
              {option.replaceAll('_', ' ')}
            </button>
          ))}
        </div>

        <div aria-live="polite">
          {error ? <p className="formError">{error}</p> : null}
          {success ? <p className="formSuccess">{success}</p> : null}
        </div>

        <div className="reviewList domainReviewList">
          {domains.map((domain) => (
            <article className="workspaceCard domainReviewCard" key={domain.id}>
              <div className="domainReviewHeading">
                <div>
                  <p className={`statusPill domain-${domain.reviewStatus}`}>
                    {domain.reviewStatus}
                  </p>
                  <h2>{domain.hostname}</h2>
                  <p>
                    {domain.merchant.name} · {domain.merchant.status}
                  </p>
                </div>
                <a
                  className="button secondary"
                  href={domain.merchant.homepageUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Visit merchant
                  <ExternalLink aria-hidden="true" size={14} />
                </a>
              </div>

              <dl className="domainReviewFacts">
                <div>
                  <dt>Recommendations</dt>
                  <dd>{domain.recommendationCount}</dd>
                </div>
                <div>
                  <dt>Creators affected</dt>
                  <dd>{domain.creatorCount}</dd>
                </div>
                <div>
                  <dt>Requested</dt>
                  <dd>
                    <time dateTime={domain.createdAt}>
                      {formatDate(domain.createdAt)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>Version</dt>
                  <dd>{domain.version}</dd>
                </div>
              </dl>

              {domain.reviewNote ? (
                <p className="domainPreviousNote">
                  <strong>Previous internal note:</strong> {domain.reviewNote}
                </p>
              ) : null}

              <label>
                Internal review note
                <textarea
                  disabled={busyId === domain.id}
                  maxLength={2_000}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [domain.id]: event.target.value,
                    }))
                  }
                  placeholder={
                    domain.reviewStatus === 'approved'
                      ? 'Required if access is disabled'
                      : 'Record verification evidence or a rejection reason'
                  }
                  rows={3}
                  value={notes[domain.id] ?? ''}
                />
              </label>

              {domain.reviewStatus !== 'approved' ? (
                <label className="domainPermissionToggle">
                  <input
                    checked={importPermissions[domain.id] ?? false}
                    disabled={busyId === domain.id}
                    onChange={(event) =>
                      setImportPermissions((current) => ({
                        ...current,
                        [domain.id]: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Also allow product metadata imports from this exact hostname
                </label>
              ) : null}

              <div className="reviewActions">
                {domain.reviewStatus === 'pending' ? (
                  <button
                    disabled={busyId === domain.id}
                    onClick={() => decide(domain, 'reject')}
                    type="button"
                  >
                    Reject
                  </button>
                ) : null}
                {domain.reviewStatus === 'approved' ? (
                  <button
                    disabled={busyId === domain.id}
                    onClick={() => decide(domain, 'disable')}
                    type="button"
                  >
                    Disable access
                  </button>
                ) : (
                  <button
                    className="approve"
                    disabled={busyId === domain.id}
                    onClick={() => decide(domain, 'approve')}
                    type="button"
                  >
                    Approve redirects
                  </button>
                )}
              </div>
            </article>
          ))}
          {!domains.length && !loading && !error ? (
            <div className="domainQueueEmpty">
              <p className="eyebrow">QUEUE CLEAR</p>
              <h2>No {status} merchant domains</h2>
              <p>New creator destinations will appear here automatically.</p>
            </div>
          ) : null}
        </div>

        {loading ? <p className="queueLoading">Loading domains…</p> : null}
        {nextCursor && !loading ? (
          <button className="button secondary queueMore" onClick={loadMore} type="button">
            Load more
          </button>
        ) : null}
      </section>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-IL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function pastTense(command: 'approve' | 'disable' | 'reject'): string {
  if (command === 'approve') return 'approved';
  if (command === 'disable') return 'disabled';
  return 'rejected';
}
