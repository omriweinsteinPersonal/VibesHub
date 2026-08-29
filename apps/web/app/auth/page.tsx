'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Suspense, useState, type FormEvent } from 'react';

import { getSupabaseBrowserClient } from '../../lib/supabase-browser';
import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';

function AuthExperience() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login',
  );
  const [role, setRole] = useState<'shopper' | 'creator'>(
    searchParams.get('role') === 'creator' ? 'creator' : 'shopper',
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const requestedNext = searchParams.get('next');
  const safeNext =
    requestedNext?.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : role === 'creator'
        ? '/creator-home'
        : '/account';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        router.replace(safeNext);
        router.refresh();
      } else {
        const next = role === 'creator' ? '/creator/apply' : '/account';
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, intended_role: role },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (authError) throw authError;
        if (data.session) router.replace(next);
        else
          setMessage(
            'Check your email to confirm your account, then continue to VibesHub.',
          );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    setError('');
    const next = mode === 'signup' && role === 'creator' ? '/creator/apply' : safeNext;
    const { error: authError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (authError) setError(authError.message);
  }

  return (
    <div className="editorialPage authExperiencePage">
      <SiteHeader />
      <main className="referenceAuthMain">
        <section className="referenceAuthIntro">
          <p className="authEyebrow">
            <Sparkles aria-hidden="true" size={14} />
            COMMUNITY FIRST
          </p>
          <h1>Join the Israeli creator marketplace</h1>
          <p>
            Shoppers save the products they trust and unlock verified discount codes.
            Creators open a storefront with recommendations, videos and codes in a few
            minutes.
          </p>
          <p dir="rtl" lang="he">
            קהילה של יוצרות ויוצרים ישראלים שממליצים רק על מה שהם באמת אוהבים.
          </p>
        </section>
        <section className="referenceAuthCard">
          <div className="referenceAuthTabs" role="tablist">
            <button
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
              role="tab"
              type="button"
            >
              Log in
            </button>
            <button
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'active' : ''}
              onClick={() => setMode('signup')}
              role="tab"
              type="button"
            >
              Create account
            </button>
          </div>
          {mode === 'signup' ? (
            <div
              className="referenceAuthTabs accountTypeTabs"
              role="group"
              aria-label="Account type"
            >
              <button
                className={role === 'shopper' ? 'active' : ''}
                onClick={() => setRole('shopper')}
                type="button"
              >
                I&apos;m A Shopper
              </button>
              <button
                className={role === 'creator' ? 'active' : ''}
                onClick={() => setRole('creator')}
                type="button"
              >
                I&apos;m A Creator
              </button>
            </div>
          ) : null}
          <button
            className="referenceGoogleButton"
            onClick={() => void continueWithGoogle()}
            type="button"
          >
            {mode === 'login' ? 'Continue' : 'Sign up'} with Google
          </button>
          <div className="separator">OR</div>
          <form onSubmit={submit}>
            {mode === 'signup' ? (
              <label>
                Full name
                <input
                  autoComplete="name"
                  maxLength={100}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  value={fullName}
                  placeholder="Noa Levi"
                />
              </label>
            ) : null}
            <label>
              Email
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
                placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
              />
            </label>
            {error ? <p className="formError">{error}</p> : null}
            {message ? <p className="formSuccess">{message}</p> : null}
            <button className="button primary" disabled={loading} type="submit">
              {loading
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Log in'
                  : `Create ${role} account`}
            </button>
          </form>
          <p className="referenceAuthTerms">
            By continuing you agree to the VibesHub community guidelines.{' '}
            <Link href="/about">Learn more</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="referenceAuthMain" aria-busy="true" />}>
      <AuthExperience />
    </Suspense>
  );
}
