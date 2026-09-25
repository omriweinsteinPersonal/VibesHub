'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import {
  destinationForAccount,
  safeInternalPath,
  type AuthenticatedAccount,
} from '../../../lib/account-destination';
import { apiRequest } from '../../../lib/api';
import { Brand } from '../../_components/brand';

function ContinueAfterLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get('next');
  const safeNext = safeInternalPath(requestedNext, '/creator-home');

  useEffect(() => {
    void apiRequest<AuthenticatedAccount>('/me')
      .then((account) => {
        const destination = destinationForAccount(account, safeNext);
        router.replace(destination);
        router.refresh();
      })
      .catch(() => {
        router.replace('/auth?mode=login&error=callback');
        router.refresh();
      });
  }, [router, safeNext]);

  return <AuthTransition message="Preparing your creator studio…" />;
}

export default function ContinueAfterLoginPage() {
  return (
    <Suspense fallback={<AuthTransition message="Signing you in…" />}>
      <ContinueAfterLogin />
    </Suspense>
  );
}

function AuthTransition({ message }: { message: string }) {
  return (
    <main aria-busy="true" className="authTransitionMain">
      <Brand />
      <section aria-live="polite" className="authTransitionCard">
        <span aria-hidden="true" className="authTransitionSpinner" />
        <h1>{message}</h1>
        <p>Your page will open in a moment.</p>
      </section>
    </main>
  );
}
