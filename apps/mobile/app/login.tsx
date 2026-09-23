import { colors, radii, spacing } from '@vibeshub/design-tokens';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getSupabaseClient } from '../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const supabase = getSupabaseClient();
      if (mode === 'login') {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
        router.replace('/');
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { intended_role: 'shopper' } },
        });
        if (authError) throw authError;
        if (data.session) router.replace('/');
        else setMessage('Check your email to confirm your account.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.eyebrow}>SWAVII COMMUNITY</Text>
        <Text style={styles.title}>
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </Text>
        <View style={styles.segmented}>
          <Pressable
            style={[styles.segment, mode === 'login' && styles.activeSegment]}
            onPress={() => setMode('login')}
          >
            <Text>Log in</Text>
          </Pressable>
          <Pressable
            style={[styles.segment, mode === 'signup' && styles.activeSegment]}
            onPress={() => setMode('signup')}
          >
            <Text>Sign up</Text>
          </Pressable>
        </View>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          style={styles.input}
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <Pressable disabled={loading} onPress={submit} style={styles.submit}>
          <Text style={styles.submitText}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  back: { color: colors.muted, marginBottom: spacing.xl },
  eyebrow: { color: colors.accent, fontSize: 11, letterSpacing: 2 },
  title: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 44,
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  segmented: {
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    flexDirection: 'row',
    marginBottom: spacing.lg,
    padding: 4,
  },
  segment: { alignItems: 'center', borderRadius: radii.control, flex: 1, padding: 12 },
  activeSegment: { backgroundColor: colors.white },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    fontSize: 16,
    marginBottom: spacing.md,
    padding: 14,
  },
  error: {
    backgroundColor: '#fff0ed',
    color: '#8a3028',
    marginBottom: spacing.md,
    padding: 12,
  },
  success: {
    backgroundColor: '#edf8f0',
    color: '#27613a',
    marginBottom: spacing.md,
    padding: 12,
  },
  submit: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.control,
    marginTop: spacing.sm,
    padding: 16,
  },
  submitText: { color: colors.white, fontSize: 16, fontWeight: '600' },
});
