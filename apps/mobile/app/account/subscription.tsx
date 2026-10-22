import { colors, spacing } from '@vibeshub/design-tokens';
import { hasCreatorProAccess } from '@vibeshub/contracts';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getBillingSummary, type BillingSummary } from '../../lib/api';
import {
  getNativePlans,
  isNativeCheckoutEnabled,
  manageNativeSubscription,
  purchaseNativePlan,
  restoreNativePurchases,
  selectNativePlan,
} from '../../lib/billing';
import { openExternalWebPage } from '../../lib/external-browser';
import { billingPeriodLabel } from '../../lib/billing-period';

export default function SubscriptionScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [plans, setPlans] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const actionInProgress = useRef(false);
  const refreshRevision = useRef(0);
  const refresh = useCallback(async () => {
    const revision = refreshRevision.current + 1;
    refreshRevision.current = revision;
    let loadedSummary = false;
    try {
      const current = await getBillingSummary();
      if (revision !== refreshRevision.current) return;
      loadedSummary = true;
      setSummary(current);
      const availablePlans = hasCreatorProAccess(current) ? [] : await getNativePlans();
      if (revision !== refreshRevision.current) return;
      setPlans(availablePlans);
      setError('');
    } catch (cause) {
      if (revision !== refreshRevision.current) return;
      if (!loadedSummary) setSummary(null);
      setPlans([]);
      setError(
        cause instanceof Error
          ? cause.message
          : 'Subscription details could not be loaded.',
      );
    } finally {
      if (revision === refreshRevision.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initialLoad = setTimeout(() => void refresh(), 0);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      ++refreshRevision.current;
      clearTimeout(initialLoad);
      listener.remove();
    };
  }, [refresh]);
  const active = summary ? hasCreatorProAccess(summary) : false;
  async function perform(action: () => Promise<void>) {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      actionInProgress.current = false;
      setBusy(false);
    }
  }
  function buy(plan: PurchasesPackage) {
    void perform(async () => {
      const result = await purchaseNativePlan(selectNativePlan(plan));
      if (result !== 'cancelled')
        setMessage(
          'Your purchase is being confirmed. Refresh shortly to see your updated access.',
        );
    });
  }
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => router.back()}
          style={styles.button}
        >
          <Text>Back</Text>
        </Pressable>
        <Text style={styles.title}>Your subscription</Text>
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading subscription" />
        ) : (
          <>
            <Text>
              {!summary
                ? 'Subscription status is unavailable.'
                : active
                  ? 'Swavii Pro is active.'
                  : 'You currently have free creator access.'}
            </Text>
            {isNativeCheckoutEnabled() ? (
              <Text>
                Test subscriptions. These plans do not change your current creator
                features.
              </Text>
            ) : (
              <Text>Paid plans are not available yet.</Text>
            )}
            {!active && isNativeCheckoutEnabled() && plans.length === 0 ? (
              <Text>No subscription plans are available right now.</Text>
            ) : null}
            {!active &&
              plans.map((plan) => (
                <View key={plan.identifier} style={styles.card}>
                  <Text style={styles.planTitle}>{plan.product.title}</Text>
                  <Text>{plan.product.description}</Text>
                  <Text>
                    {plan.product.priceString} every{' '}
                    {billingPeriodLabel(plan.product.subscriptionPeriod)}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy || !summary}
                    onPress={() => buy(plan)}
                    style={styles.button}
                  >
                    <Text>Subscribe · {plan.product.priceString}</Text>
                  </Pressable>
                </View>
              ))}
            <Text>
              Subscriptions renew automatically unless cancelled in your store account.
              Deleting your Swavii account does not cancel a store subscription.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                void perform(async () => {
                  const restored = await restoreNativePurchases();
                  setMessage(
                    restored
                      ? 'Purchase found. Your access is being confirmed.'
                      : 'No active Swavii Pro purchase was found for this store account.',
                  );
                })
              }
              style={styles.button}
            >
              <Text>Restore purchases</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void perform(manageNativeSubscription)}
              style={styles.button}
            >
              <Text>Manage store subscriptions</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void refresh()}
              style={styles.button}
            >
              <Text>Refresh subscription status</Text>
            </Pressable>
          </>
        )}
        {busy ? (
          <ActivityIndicator accessibilityLabel="Processing purchase request" />
        ) : null}
        {message ? <Text accessibilityRole="alert">{message}</Text> : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        {['terms', 'privacy'].map((page) => (
          <Pressable
            accessibilityRole="link"
            key={page}
            style={styles.button}
            onPress={() =>
              void openExternalWebPage(`https://swavii.com/${page}`).catch(() =>
                setError('This link could not be opened.'),
              )
            }
          >
            <Text>{page === 'terms' ? 'Terms of service' : 'Privacy policy'}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.lg, gap: spacing.lg },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink },
  planTitle: { fontSize: 20, fontWeight: '700' },
  card: {
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#d8c6b8',
    borderRadius: 16,
  },
  button: {
    padding: spacing.md,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#f5e4d7',
  },
  error: { color: '#a02323' },
});
