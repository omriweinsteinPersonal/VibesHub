import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const installationIdKey = 'swavii.content-safety.installation-id';
const hiddenCreatorsKey = 'swavii.content-safety.hidden-creators';

export async function getContentSafetyInstallationId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(installationIdKey);
  if (existing) return existing;

  const installationId = Crypto.randomUUID();
  await SecureStore.setItemAsync(installationIdKey, installationId);
  return installationId;
}

export async function getHiddenCreatorIds(): Promise<Set<string>> {
  const stored = await SecureStore.getItemAsync(hiddenCreatorsKey);
  if (!stored) return new Set();
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

export async function hideCreator(creatorId: string): Promise<void> {
  const hidden = await getHiddenCreatorIds();
  hidden.add(creatorId);
  await SecureStore.setItemAsync(hiddenCreatorsKey, JSON.stringify([...hidden]));
}

export async function showCreator(creatorId: string): Promise<void> {
  const hidden = await getHiddenCreatorIds();
  hidden.delete(creatorId);
  await SecureStore.setItemAsync(hiddenCreatorsKey, JSON.stringify([...hidden]));
}
