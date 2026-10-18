import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <Text style={styles.logo}>swavii</Text>
      <View style={styles.body}>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.copy}>
          This link does not match a page in the Swavii app.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryText}>Go home</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/creators')}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryText}>Browse Swavii</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#fbf9f6', flex: 1, padding: 22 },
  logo: { color: '#30251f', fontFamily: 'Georgia', fontSize: 30 },
  body: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  title: { color: '#30251f', fontFamily: 'Georgia', fontSize: 31, textAlign: 'center' },
  copy: {
    color: '#766b64',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 320,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#b77856',
    borderRadius: 999,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  secondaryButton: { marginTop: 16, padding: 8 },
  secondaryText: { color: '#30251f', textDecorationLine: 'underline' },
});
