import type { Session } from '@supabase/supabase-js';
import { useEffect } from 'react';

import { getBillingSummary } from '../lib/api';
import {
  configureNativeBilling,
  isNativeBillingConfigured,
  resetNativeBilling,
} from '../lib/billing';
import { getSupabaseClient } from '../lib/supabase';

export function BillingBootstrap() {
  useEffect(() => {
    if (!isNativeBillingConfigured()) return;
    let active = true;
    let revision = 0;
    let sessionUserId: string | undefined;
    let scheduled: ReturnType<typeof setTimeout> | undefined;

    async function synchronize(
      session: Session | null,
      currentRevision: number,
    ): Promise<void> {
      if (!active) return;
      try {
        if (!session) {
          await resetNativeBilling();
          return;
        }
        const billing = await getBillingSummary();
        if (active && currentRevision === revision)
          await configureNativeBilling(billing.customerId);
      } catch {
        // Billing must never block authentication or navigation. A later auth
        // refresh retries synchronization after transient API/provider errors.
      }
    }

    const supabase = getSupabaseClient();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentRevision = ++revision;
      clearTimeout(scheduled);
      if (sessionUserId !== session?.user.id || !session) {
        sessionUserId = session?.user.id;
        void resetNativeBilling().catch(() => undefined);
      }
      // Defer work until Supabase releases its auth lock. INITIAL_SESSION also
      // covers app startup; a second getSession request can race a later sign-out.
      if (session)
        scheduled = setTimeout(() => void synchronize(session, currentRevision), 0);
    });

    return () => {
      active = false;
      ++revision;
      clearTimeout(scheduled);
      data.subscription.unsubscribe();
    };
  }, []);

  return null;
}
