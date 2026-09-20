'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { getSupabaseBrowserClient } from '../../lib/supabase-browser';

export default function JoinPage() {
  const router = useRouter();
  const [role, setRole] = useState<'shopper' | 'creator'>('shopper');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const next = role === 'creator' ? '/creator/apply' : '/account';
      const { data, error: authError } = await getSupabaseBrowserClient().auth.signUp({
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
        setMessage('Check your email to confirm your account, then continue to Swave.');
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : 'Account creation failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authIntro">
        <p className="eyebrow">COMMUNITY FIRST</p>
        <h1>Join the Israeli creator marketplace</h1>
        <p>
          Shoppers save products they trust. Creators open a storefront with
          recommendations and codes.
        </p>
      </section>
      <section className="authCard" aria-labelledby="join-title">
        <h2 id="join-title">Create account</h2>
        <div className="segmented" role="group" aria-label="Account type">
          <button
            className={role === 'shopper' ? 'active' : ''}
            type="button"
            onClick={() => setRole('shopper')}
          >
            I&apos;m a Shopper
          </button>
          <button
            className={role === 'creator' ? 'active' : ''}
            type="button"
            onClick={() => setRole('creator')}
          >
            I&apos;m a Creator
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Full name
            <input
              autoComplete="name"
              maxLength={100}
              onChange={(event) => setFullName(event.target.value)}
              required
              value={fullName}
            />
          </label>
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          {error ? <p className="formError">{error}</p> : null}
          {message ? <p className="formSuccess">{message}</p> : null}
          <button className="button primary formSubmit" disabled={loading} type="submit">
            {loading ? 'Creating account…' : `Create ${role} account`}
          </button>
        </form>
        <p className="authSwitch">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </section>
    </main>
  );
}
