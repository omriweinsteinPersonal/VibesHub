'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { getSupabaseBrowserClient } from '../../lib/supabase-browser';

export function WorkspaceHeader() {
  const router = useRouter();

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut();
    router.replace('/');
    router.refresh();
  }

  return (
    <header className="workspaceHeader">
      <Link className="logo" href="/">
        <span>✣</span> VibesHub
      </Link>
      <nav aria-label="Shopper account">
        <Link href="/account/saved">Saved products</Link>
        <Link href="/account/following">Following</Link>
        <Link href="/account">Account</Link>
      </nav>
      <button className="button secondary" type="button" onClick={signOut}>
        Sign out
      </button>
    </header>
  );
}
