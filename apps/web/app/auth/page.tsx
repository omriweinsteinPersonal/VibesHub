'use client';

import Link from 'next/link';
import Image from 'next/image';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';

import { apiRequest } from '../../lib/api';
import {
  destinationForAccount,
  safeInternalPath,
  type AuthenticatedAccount,
} from '../../lib/account-destination';
import { getSupabaseBrowserClient } from '../../lib/supabase-browser';
import styles from './auth.module.css';

type GoogleCredentialResponse = { credential?: string };

type GoogleIdentity = {
  initialize: (configuration: {
    button_auto_select?: boolean;
    callback: (response: GoogleCredentialResponse) => void;
    client_id: string;
    itp_support?: boolean;
    nonce?: string;
    use_fedcm_for_button?: boolean;
    ux_mode?: 'popup' | 'redirect';
  }) => void;
  renderButton: (
    parent: HTMLElement,
    configuration: {
      logo_alignment: 'left' | 'center';
      shape: 'pill' | 'rectangular';
      size: 'large' | 'medium' | 'small';
      text: 'continue_with' | 'signup_with';
      theme: 'outline';
      type: 'standard';
      width: number;
    },
  ) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

function createNonce(): string {
  const values = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(values, (value) => value.toString(16).padStart(2, '0')).join('');
}

async function hashNonce(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function AuthExperience() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login',
  );
  const [fullName, setFullName] = useState(
    (searchParams.get('name') ?? '').slice(0, 100),
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    searchParams.get('error')
      ? 'We could not complete that login. Please try again.'
      : '',
  );
  const [message, setMessage] = useState(
    searchParams.get('reset') === 'success'
      ? 'Your password has been updated. You can log in now.'
      : '',
  );
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [googleButtonReady, setGoogleButtonReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleCallbackRef = useRef<
    (response: GoogleCredentialResponse) => Promise<void>
  >(() => Promise.resolve());
  const googleModeRef = useRef(mode);
  const googleNonceRef = useRef('');
  const googleInitializedRef = useRef(false);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  const requestedNext = searchParams.get('next');
  const safeNext = safeInternalPath(requestedNext, '/creator-home');

  useEffect(() => {
    googleModeRef.current = mode;
  }, [mode]);

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
        const account = await apiRequest<AuthenticatedAccount>('/me');
        const destination = destinationForAccount(account, safeNext);
        router.replace(destination);
        router.refresh();
      } else {
        const next = '/creator/apply';
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, intended_role: 'creator' },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (authError) throw authError;
        if (data.session) router.replace(next);
        else
          setMessage(
            'Check your email to confirm your account, then continue to swavii.',
          );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogleRedirect() {
    setError('');
    setOauthLoading(true);
    const next = mode === 'signup' ? '/creator/apply' : safeNext;
    const { error: authError } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (authError) {
      setError(authError.message);
      setOauthLoading(false);
    }
  }

  useEffect(() => {
    googleCallbackRef.current = async (response) => {
      if (!response.credential) {
        setError('Google did not return a sign-in credential. Please try again.');
        return;
      }

      setError('');
      setMessage('');
      setOauthLoading(true);
      const next = googleModeRef.current === 'signup' ? '/creator/apply' : safeNext;
      try {
        const { error: authError } =
          await getSupabaseBrowserClient().auth.signInWithIdToken({
            provider: 'google',
            token: response.credential,
            nonce: googleNonceRef.current,
          });
        if (authError) throw authError;

        try {
          const account = await apiRequest<AuthenticatedAccount>('/me');
          router.replace(destinationForAccount(account, next));
          router.refresh();
        } catch {
          router.replace(`/auth/continue?next=${encodeURIComponent(next)}`);
          router.refresh();
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Google sign-in failed.');
        setOauthLoading(false);
      }
    };
  }, [router, safeNext]);

  useEffect(() => {
    if (!googleClientId || !googleScriptReady || googleInitializedRef.current) return;

    let cancelled = false;
    void (async () => {
      const nonce = createNonce();
      const hashedNonce = await hashNonce(nonce);
      if (cancelled || !window.google) return;

      googleNonceRef.current = nonce;
      window.google.accounts.id.initialize({
        button_auto_select: false,
        callback: (response) => {
          void googleCallbackRef.current(response);
        },
        client_id: googleClientId,
        itp_support: true,
        nonce: hashedNonce,
        use_fedcm_for_button: true,
        ux_mode: 'popup',
      });
      googleInitializedRef.current = true;
      setGoogleButtonReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [googleClientId, googleScriptReady]);

  useEffect(() => {
    const container = googleButtonRef.current;
    const identity = window.google?.accounts.id;
    if (!container || !identity || !googleButtonReady) return;

    const render = () => {
      container.replaceChildren();
      identity.renderButton(container, {
        logo_alignment: 'left',
        shape: 'pill',
        size: 'large',
        text: mode === 'signup' ? 'signup_with' : 'continue_with',
        theme: 'outline',
        type: 'standard',
        width: Math.min(400, Math.max(200, Math.floor(container.clientWidth))),
      });
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(container);
    return () => observer.disconnect();
  }, [googleButtonReady, mode]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link aria-label="swavii home" className={styles.wordmark} href="/">
          swavii
        </Link>
        <Link className={styles.backLink} href="/">
          <span aria-hidden="true">←</span> Back to homepage
        </Link>
      </header>
      <main className={styles.main}>
        <div className={styles.visual}>
          <Image
            alt="Creator with examples of content and recommendations"
            className={styles.visualImage}
            height={1254}
            loading="lazy"
            src="/images/auth/creator-login.jpg"
            width={1254}
          />
        </div>
        <section aria-labelledby="auth-heading" className={styles.auth}>
          <div className={styles.formWrap}>
            <h1 id="auth-heading">
              {mode === 'signup'
                ? 'Make a page that feels like you.'
                : 'Welcome back to your world.'}
            </h1>
            <p className={styles.intro}>
              {mode === 'signup'
                ? 'Start with your name. Make everything else your own.'
                : 'Log in to keep shaping your page.'}
            </p>
            <div aria-label="Account mode" className={styles.tabs} role="tablist">
              <button
                aria-selected={mode === 'login'}
                className={mode === 'login' ? styles.activeTab : ''}
                onClick={() => setMode('login')}
                role="tab"
                type="button"
              >
                Log in
              </button>
              <button
                aria-selected={mode === 'signup'}
                className={mode === 'signup' ? styles.activeTab : ''}
                onClick={() => setMode('signup')}
                role="tab"
                type="button"
              >
                Create account
              </button>
            </div>
            {googleClientId ? (
              <>
                <Script
                  onError={() =>
                    setError('Google sign-in could not load. Please try again.')
                  }
                  onReady={() => setGoogleScriptReady(true)}
                  src="https://accounts.google.com/gsi/client"
                  strategy="afterInteractive"
                />
                <div
                  aria-busy={!googleButtonReady || oauthLoading}
                  className={styles.googleSlot}
                >
                  <div ref={googleButtonRef} />
                  {!googleButtonReady || oauthLoading || loading ? (
                    <span className={styles.googleStatus}>
                      {oauthLoading ? 'Signing you in…' : 'Loading Google…'}
                    </span>
                  ) : null}
                </div>
              </>
            ) : (
              <button
                aria-busy={oauthLoading}
                className={styles.googleButton}
                disabled={oauthLoading || loading}
                onClick={() => void continueWithGoogleRedirect()}
                type="button"
              >
                {oauthLoading
                  ? 'Opening Google…'
                  : `${mode === 'login' ? 'Continue' : 'Sign up'} with Google`}
              </button>
            )}
            <div className={styles.separator}>OR USE EMAIL</div>
            <form className={styles.form} onSubmit={submit}>
              {mode === 'signup' ? (
                <label className={styles.field}>
                  Full name
                  <input
                    autoComplete="name"
                    maxLength={100}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    value={fullName}
                    placeholder="Your full name"
                  />
                </label>
              ) : null}
              <label className={styles.field}>
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
              <div className={styles.passwordField}>
                <div className={styles.passwordHeading}>
                  <label htmlFor="auth-password">Password</label>
                  {mode === 'login' ? (
                    <Link
                      className={styles.recoveryLink}
                      href={`/auth/reset-password?email=${encodeURIComponent(email)}`}
                    >
                      Forgot password?
                    </Link>
                  ) : null}
                </div>
                <input
                  id="auth-password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
                />
              </div>
              {error ? <p className="formError">{error}</p> : null}
              {message ? <p className="formSuccess">{message}</p> : null}
              <button className={styles.submit} disabled={loading} type="submit">
                {loading
                  ? 'Please wait…'
                  : mode === 'login'
                    ? 'Log in'
                    : 'Create your page'}
              </button>
            </form>
            <p className={styles.terms}>
              By continuing, you agree to the <Link href="/terms">Terms of Service</Link>{' '}
              and acknowledge the <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div aria-busy="true" className={styles.page} />}>
      <AuthExperience />
    </Suspense>
  );
}
