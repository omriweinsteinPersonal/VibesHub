'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ApiError, apiRequest } from '../../lib/api';
import { CreatorAccount } from '../_components/creator-account';

interface AccountSummary {
  capabilities: string[];
  creator: { handle: string; id: string } | null;
  email?: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiRequest<AccountSummary>('/me')
      .then((loadedAccount) => {
        if (!active) return;
        if (loadedAccount.creator) {
          setAccount(loadedAccount);
          return;
        }
        const isPlatformOperator = loadedAccount.capabilities.some((capability) =>
          ['admin:manage_platform', 'moderator:review_content'].includes(capability),
        );
        router.replace(isPlatformOperator ? '/admin/applications' : '/creator/apply');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) {
          router.replace('/auth?mode=login&next=%2Faccount');
          return;
        }
        setError(
          cause instanceof Error
            ? cause.message
            : 'We could not open your creator account.',
        );
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (account?.creator) {
    return <CreatorAccount {...(account.email ? { email: account.email } : {})} />;
  }

  return (
    <main className="creatorLoading" role={error ? 'alert' : 'status'}>
      {error || 'Opening your creator account...'}
    </main>
  );
}
