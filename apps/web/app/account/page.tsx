'use client';

import Link from 'next/link';
import { LogOut, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, apiRequest } from '../../lib/api';
import { getSupabaseBrowserClient } from '../../lib/supabase-browser';
import { CreatorAccount } from '../_components/creator-account';
import { SiteHeader } from '../_components/site-header';

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
  const [state, setState] = useState<'loading' | 'ready' | 'signedOut' | 'error'>(
    'loading',
  );
  const [error, setError] = useState('We could not open your account right now.');

  useEffect(() => {
    void apiRequest<AccountSummary>('/me')
      .then((loadedAccount) => {
        setAccount(loadedAccount);
        setState('ready');
      })
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401) {
          setState('signedOut');
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : 'We could not open your account right now.',
        );
        setState('error');
      });
  }, []);

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace('/');
    router.refresh();
  }

  if (state === 'ready' && account?.creator) {
    return <CreatorAccount {...(account.email ? { email: account.email } : {})} />;
  }

  return (
    <main className="workspacePage">
      <SiteHeader />
      {state === 'loading' ? <AccountSkeleton /> : null}
      {state === 'signedOut' ? <SignedOutAccount /> : null}
      {state === 'error' ? <AccountError message={error} /> : null}
      {state === 'ready' && account ? (
        <section className="workspaceContent">
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Welcome, {account.profile.displayName}</h1>
          <div className="workspaceGrid">
            <article className="workspaceCard">
              <h2>Saved products</h2>
              <p>Return to the recommendations you want to remember.</p>
              <Link className="button primary" href="/account/saved">
                View saved products
              </Link>
            </article>
            <article className="workspaceCard">
              <h2>Following</h2>
              <p>Keep up with creators whose taste matches yours.</p>
              <Link className="button secondary" href="/account/following">
                View followed creators
              </Link>
            </article>
            <article className="workspaceCard">
              <h2>Shopper profile</h2>
              <p>{account.email}</p>
              <p>{account.capabilities.length} active platform capabilities</p>
              <button
                className="button secondary accountSignOutButton"
                onClick={() => void signOut()}
                type="button"
              >
                <LogOut aria-hidden="true" size={16} />
                Sign out
              </button>
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
                    <Link className="button secondary" href="/creator/profile">
                      Edit storefront profile
                    </Link>
                    <Link className="button secondary" href="/creator/discount-codes">
                      Manage discount codes
                    </Link>
                    <Link className="button secondary" href="/creator/analytics">
                      View analytics
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
        </section>
      ) : null}
    </main>
  );
}

function AccountSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading account"
      className="workspaceContent accountSkeleton"
    >
      <span className="skeletonLine skeletonEyebrow" />
      <span className="skeletonLine skeletonHeading" />
      <div className="workspaceGrid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="workspaceCard skeletonCard" key={index}>
            <span className="skeletonLine skeletonCardTitle" />
            <span className="skeletonLine skeletonCopy" />
            <span className="skeletonLine skeletonButton" />
          </div>
        ))}
      </div>
    </section>
  );
}

function SignedOutAccount() {
  return (
    <section className="workspaceContent accountGuest">
      <div className="accountGuestMark" aria-hidden="true">
        <Sparkles size={20} />
      </div>
      <p className="eyebrow">YOUR SWAVII</p>
      <h1>Keep the things you love close</h1>
      <p className="workspaceLead">
        Log in to return to your saved products, followed creators and creator storefront
        tools.
      </p>
      <div className="accountGuestActions">
        <Link className="button primary" href="/login?next=%2Faccount">
          Log in to your account
        </Link>
        <Link className="button secondary" href="/join">
          Create an account
        </Link>
      </div>
    </section>
  );
}

function AccountError({ message }: { message: string }) {
  return (
    <section className="workspaceContent accountGuest">
      <p className="eyebrow">YOUR ACCOUNT</p>
      <h1>We could not open this page</h1>
      <p className="workspaceLead">{message}</p>
      <Link className="button secondary" href="/account">
        Try again
      </Link>
    </section>
  );
}
