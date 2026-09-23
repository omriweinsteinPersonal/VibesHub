'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, type FormEvent, useState } from 'react';

import { getSupabaseBrowserClient } from '../../lib/supabase-browser';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get('next');
  const next =
    requestedNext?.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/account';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    searchParams.get('error')
      ? 'We could not complete that login. Please try again.'
      : '',
  );
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error: authError } =
        await getSupabaseBrowserClient().auth.signInWithPassword({
          email,
          password,
        });
      if (authError) throw authError;
      router.replace(next);
      router.refresh();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    setError('');
    const { error: authError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (authError) setError(authError.message);
  }

  return (
    <main className="authPage">
      <section className="authIntro">
        <p className="eyebrow">COMMUNITY FIRST</p>
        <h1>Welcome back to swavii</h1>
        <p>
          Save trusted recommendations, follow creators and manage your storefront in one
          place.
        </p>
        <p className="hebrewIntro" dir="rtl" lang="he">
          קהילה של יוצרות ויוצרים ישראלים שממליצים רק על מה שהם באמת אוהבים.
        </p>
      </section>
      <section className="authCard" aria-labelledby="login-title">
        <h2 id="login-title">Log in</h2>
        <button className="oauthButton" type="button" onClick={continueWithGoogle}>
          Continue with Google
        </button>
        <div className="separator">OR</div>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="formError">{error}</p> : null}
          <button className="button primary formSubmit" disabled={loading} type="submit">
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="authSwitch">
          New to swavii? <Link href="/join">Create an account</Link>
        </p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="authPage" aria-busy="true" />}>
      <LoginForm />
    </Suspense>
  );
}
