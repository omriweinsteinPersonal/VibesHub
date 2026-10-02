'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';

import { getSupabaseBrowserClient } from '../../../lib/supabase-browser';
import { SiteFooter } from '../../_components/site-footer';
import { SiteHeader } from '../../_components/site-header';

function ResetPasswordExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    void supabase.auth.getSession().then(({ data }) => {
      setRecoveryReady(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setRecoveryReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const { error: authError } =
        await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
      if (authError) throw authError;
      setMessage('If an account uses this email, we sent a password reset link.');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'We could not send the reset email.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('The passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: authError } = await getSupabaseBrowserClient().auth.updateUser({
        password,
      });
      if (authError) throw authError;
      await getSupabaseBrowserClient().auth.signOut();
      router.push('/auth?mode=login&reset=success');
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'We could not update your password.',
      );
      setLoading(false);
    }
  }

  return (
    <div className="editorialPage authExperiencePage">
      <SiteHeader />
      <main className="referenceAuthMain">
        <section className="referenceAuthIntro">
          <p className="authEyebrow">ACCOUNT ACCESS</p>
          <h1>{recoveryReady ? 'Choose a new password' : 'Reset your password'}</h1>
          <p>
            {recoveryReady
              ? 'Use a new password that you have not used elsewhere.'
              : 'Enter your email and we will send you a secure reset link.'}
          </p>
        </section>
        <section className="referenceAuthCard">
          {recoveryReady ? (
            <form onSubmit={updatePassword}>
              <label>
                New password
                <input
                  autoComplete="new-password"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <label>
                Confirm new password
                <input
                  autoComplete="new-password"
                  minLength={8}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  type="password"
                  value={confirmation}
                />
              </label>
              {error ? <p className="formError">{error}</p> : null}
              <button className="button primary" disabled={loading} type="submit">
                {loading ? 'Updating password…' : 'Update password'}
              </button>
            </form>
          ) : (
            <form onSubmit={requestReset}>
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
              {error ? <p className="formError">{error}</p> : null}
              {message ? <p className="formSuccess">{message}</p> : null}
              <button className="button primary" disabled={loading} type="submit">
                {loading ? 'Sending link…' : 'Send reset link'}
              </button>
            </form>
          )}
          <p className="referenceAuthTerms">
            <Link href="/auth?mode=login">Back to log in</Link>
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="referenceAuthMain" aria-busy="true" />}>
      <ResetPasswordExperience />
    </Suspense>
  );
}
