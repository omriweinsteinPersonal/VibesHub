'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { apiRequest } from '../../lib/api';

interface BillingSummary {
  entitlements: { key: string; active: boolean; expiresAt: string | null }[];
}

export default function SubscriptionPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setSummary(await apiRequest<BillingSummary>('/v1/billing'));
      setError('');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Subscription status could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initialLoad = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(initialLoad);
  }, [refresh]);
  const active = summary?.entitlements.some(
    (entry) => entry.key === 'creator_pro' && entry.active,
  );
  return (
    <main
      style={{
        maxWidth: 680,
        padding: '32px 20px',
        margin: '0 auto',
        overflowWrap: 'anywhere',
      }}
    >
      <Link href="/account">Back to account</Link>
      <h1>Your subscription</h1>
      {loading ? (
        <p role="status">Loading subscription…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : (
        <>
          <p>
            {active
              ? 'Swavii Pro is active on your account.'
              : 'You currently have free creator access.'}
          </p>
          <p>
            Purchases made in the iPhone or Android app use the same Swavii account.
            Manage or cancel them in the Apple or Google account used to purchase.
          </p>
          <p>Paid plans are not currently offered on the website.</p>
        </>
      )}
      <button disabled={loading} onClick={() => void refresh()} style={{ minHeight: 48 }}>
        Refresh subscription status
      </button>
      <p>
        <Link href="/support">Contact support</Link>
      </p>
    </main>
  );
}
