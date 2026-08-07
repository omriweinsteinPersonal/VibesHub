'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiRequest } from '../../lib/api';
import { getSupabaseBrowserClient } from '../../lib/supabase-browser';

interface AccountSummary {
  application: { id: string; status: string } | null;
  capabilities: string[];
  creator: { handle: string; id: string } | null;
  email?: string;
  profile: { displayName: string };
}

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void apiRequest<AccountSummary>('/me')
      .then(setAccount)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Could not load account.'),
      );
  }, []);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace('/');
    router.refresh();
  }

  return (
    <main className="workspacePage">
      <header className="workspaceHeader">
        <Link className="logo" href="/">
          <span>✣</span> VibesHub
        </Link>
        <button className="button secondary" type="button" onClick={signOut}>
          Sign out
        </button>
      </header>
      <section className="workspaceContent">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>
          {account ? `Welcome, ${account.profile.displayName}` : 'Loading your account…'}
        </h1>
        {error ? <p className="formError">{error}</p> : null}
        {account ? (
          <div className="workspaceGrid">
            <article className="workspaceCard">
              <h2>Shopper profile</h2>
              <p>{account.email}</p>
              <p>{account.capabilities.length} active platform capabilities</p>
            </article>
            <article className="workspaceCard">
              <h2>Creator journey</h2>
              {account.creator ? (
                <>
                  <p>
                    Your creator profile @{account.creator.handle} is ready for the
                    studio.
                  </p>
                  <div className="accountActions">
                    <Link className="button primary" href="/creator/recommendations">
                      Open Creator Studio
                    </Link>
                    <Link
                      className="button secondary"
                      href={`/creators/${account.creator.handle}`}
                    >
                      View storefront
                    </Link>
                  </div>
                </>
              ) : account.application ? (
                <p>
                  Your creator application is currently{' '}
                  {account.application.status.replaceAll('_', ' ')}.
                </p>
              ) : (
                <p>Apply to open a creator storefront and share recommendations.</p>
              )}
              {!account.creator ? (
                <Link className="button primary" href="/creator/apply">
                  {account.application ? 'View application' : 'Join as Creator'}
                </Link>
              ) : null}
            </article>
            {account.capabilities.includes('admin:manage_platform') ? (
              <article className="workspaceCard">
                <p className="eyebrow">PLATFORM OPERATIONS</p>
                <h2>Merchant-domain reviews</h2>
                <p>
                  Approve exact shopping domains before creator recommendations can send
                  shoppers to them.
                </p>
                <Link className="button primary" href="/admin/merchant-domains">
                  Open domain queue
                </Link>
              </article>
            ) : null}
            {account.capabilities.some((capability) =>
              ['admin:manage_platform', 'moderator:review_content'].includes(capability),
            ) ? (
              <article className="workspaceCard">
                <p className="eyebrow">MODERATION</p>
                <h2>Creator applications</h2>
                <p>Review creator identities before their storefronts are published.</p>
                <Link className="button secondary" href="/admin/applications">
                  Open application queue
                </Link>
              </article>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
