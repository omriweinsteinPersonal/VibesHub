import { Linking } from 'react-native';

export async function openExternalWebPage(url: string): Promise<void> {
  // External legal and merchant pages belong in the system browser. Core
  // Swavii flows stay inside native React Native screens; OAuth is the only
  // intentional system authentication session.
  await Linking.openURL(url);
}
