'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';

import { apiRequest } from '../../lib/api';
import {
  destinationForAccount,
  safeInternalPath,
  type AuthenticatedAccount,
} from '../../lib/account-destination';
import { getSupabaseBrowserClient } from '../../lib/supabase-browser';
import { SiteFooter } from '../_components/site-footer';
import { SiteHeader } from '../_components/site-header';

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
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    searchParams.get('error')
      ? 'We could not complete that login. Please try again.'
      : '',
  );
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [googleButtonReady, setGoogleButtonReady] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const googleCallbackRef = useRef<(response: GoogleCredentialResponse) => void>(
    () => undefined,
  );
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
        callback: (response) => googleCallbackRef.current(response),
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
    <div className="editorialPage authExperiencePage">
      <SiteHeader />
      <main className="referenceAuthMain">
        <section className="referenceAuthIntro">
          <p className="authEyebrow">
            <Sparkles aria-hidden="true" size={14} />
            FOR CREATORS
          </p>
          <h1>{mode === 'signup' ? 'Create your swavii page' : 'Welcome back'}</h1>
          <p>
            {mode === 'signup'
              ? 'Give shoppers one trusted place to discover the products you truly recommend, watch your videos and use verified discount codes. Create your storefront in just a few minutes.'
              : 'Log in to manage your page and recommendations.'}
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
                className="googleIdentityButtonSlot"
              >
                <div ref={googleButtonRef} />
                {!googleButtonReady || oauthLoading || loading ? (
                  <span className="googleIdentityButtonStatus">
                    {oauthLoading ? 'Signing you in…' : 'Loading Google…'}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <button
              aria-busy={oauthLoading}
              className="referenceGoogleButton"
              disabled={oauthLoading || loading}
              onClick={() => void continueWithGoogleRedirect()}
              type="button"
            >
              {oauthLoading
                ? 'Opening Google…'
                : `${mode === 'login' ? 'Continue' : 'Sign up'} with Google`}
            </button>
          )}
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
                  placeholder="Your full name"
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
                  : 'Create your page'}
            </button>
          </form>
          <p className="referenceAuthTerms">
            By continuing, you agree to the <Link href="/terms">Terms of Service</Link>{' '}
            and acknowledge the <Link href="/privacy">Privacy Policy</Link>.
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
