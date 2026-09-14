'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { apiRequest } from '../../../lib/api';

export default function ContinueAfterLoginPage() {
  const router = useRouter();

  useEffect(() => {
    void apiRequest<{ creator: { handle: string; id: string } | null }>('/me')
      .then((account) => {
        router.replace(account.creator ? '/creator-home' : '/account');
        router.refresh();
      })
      .catch(() => {
        router.replace('/account');
        router.refresh();
      });
  }, [router]);

  return <main className="creatorLoading">Opening your account...</main>;
}
