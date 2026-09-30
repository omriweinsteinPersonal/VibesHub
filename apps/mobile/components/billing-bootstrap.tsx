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

    async function synchronize(session: Session | null): Promise<void> {
      if (!active) return;
      try {
        if (!session) {
          await resetNativeBilling();
          return;
        }
        const billing = await getBillingSummary();
        if (active) await configureNativeBilling(billing.customerId);
      } catch {
        // Billing must never block authentication or navigation. A later auth
        // refresh retries synchronization after transient API/provider errors.
      }
    }

    const supabase = getSupabaseClient();
    void supabase.auth.getSession().then(({ data }) => synchronize(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void synchronize(session);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return null;
}
