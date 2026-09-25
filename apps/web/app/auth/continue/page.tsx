'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { apiRequest } from '../../../lib/api';

function ContinueAfterLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get('next');
  const safeNext =
    requestedNext?.startsWith('/') && !requestedNext.startsWith('//')
      ? requestedNext
      : '/creator-home';

  useEffect(() => {
    void apiRequest<{
      capabilities: string[];
      creator: { handle: string; id: string } | null;
    }>('/me')
      .then((account) => {
        const destination = account.creator
          ? safeNext
          : account.capabilities.some((capability) =>
                ['admin:manage_platform', 'moderator:review_content'].includes(
                  capability,
                ),
              )
            ? '/admin/applications'
            : '/creator/apply';
        router.replace(destination);
        router.refresh();
      })
      .catch(() => {
        router.replace('/auth?mode=login&error=callback');
        router.refresh();
      });
  }, [router, safeNext]);

  return <main className="creatorLoading">Opening your creator account...</main>;
}

export default function ContinueAfterLoginPage() {
  return (
    <Suspense fallback={<main className="creatorLoading">Signing you in...</main>}>
      <ContinueAfterLogin />
    </Suspense>
  );
}
