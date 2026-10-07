import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context';

import { BillingBootstrap } from '../components/billing-bootstrap';

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <BillingBootstrap />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
