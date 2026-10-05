import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

export async function openExternalWebPage(url: string): Promise<void> {
  if (Platform.OS === 'web') {
    await Linking.openURL(url);
    return;
  }

  await WebBrowser.openBrowserAsync(url, {
    createTask: false,
    dismissButtonStyle: 'close',
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}
