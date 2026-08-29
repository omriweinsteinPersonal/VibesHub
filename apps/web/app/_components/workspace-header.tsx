'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { getSupabaseBrowserClient } from '../../lib/supabase-browser';
import { Brand } from './brand';

interface WorkspaceHeaderProps {
  sessionState?: 'anonymous' | 'authenticated' | 'loading';
}

export function WorkspaceHeader({
  sessionState = 'authenticated',
}: WorkspaceHeaderProps) {
  const router = useRouter();

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace('/');
    router.refresh();
  }

  return (
    <header className="workspaceHeader">
      <Brand />
      {sessionState === 'anonymous' ? (
        <nav aria-label="Primary navigation">
          <Link href="/creators">Creators</Link>
          <Link href="/discover">Discover</Link>
        </nav>
      ) : (
        <nav aria-label="Shopper account">
          <Link href="/account/saved">Saved products</Link>
          <Link href="/account/following">Following</Link>
          <Link href="/account">Account</Link>
        </nav>
      )}
      {sessionState === 'loading' ? (
        <span className="workspaceHeaderActionPlaceholder" aria-hidden="true" />
      ) : sessionState === 'anonymous' ? (
        <Link className="button secondary" href="/login?next=%2Faccount">
          Log in
        </Link>
      ) : (
        <button className="button secondary" type="button" onClick={signOut}>
          Sign out
        </button>
      )}
    </header>
  );
}
