import { colors, spacing } from '@vibeshub/design-tokens';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { establishSessionFromCallback } from '../../lib/auth';

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Linking.getInitialURL()
      .then(async (url) => {
        if (!url) throw new Error('The sign-in callback is missing.');
        await establishSessionFromCallback(url);
        if (active) router.replace('/account');
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>
        {error ? 'Could not sign you in' : 'Signing you in…'}
      </Text>
      <Text style={styles.body}>{error || 'This will only take a moment.'}</Text>
      {error ? (
        <Pressable onPress={() => router.replace('/login')} style={styles.button}>
          <Text style={styles.buttonText}>Back to sign in</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.muted, marginTop: spacing.sm, textAlign: 'center' },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonText: { color: colors.white, fontWeight: '600' },
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  title: { color: colors.ink, fontFamily: 'Georgia', fontSize: 32, textAlign: 'center' },
});
