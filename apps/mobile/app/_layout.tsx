import 'react-native-gesture-handler';

import { Stack } from 'expo-router';

import { BillingBootstrap } from '../components/billing-bootstrap';

export default function RootLayout() {
  return (
    <>
      <BillingBootstrap />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
