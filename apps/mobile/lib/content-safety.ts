import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const installationIdKey = 'swavii.content-safety.installation-id';
const hiddenCreatorsKey = 'swavii.content-safety.hidden-creators';
let fallbackInstallationId: string | null = null;
let fallbackHiddenCreatorIds = new Set<string>();

export async function getContentSafetyInstallationId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(installationIdKey);
    if (existing) return existing;
  } catch {
    if (fallbackInstallationId) return fallbackInstallationId;
  }

  const installationId = Crypto.randomUUID();
  fallbackInstallationId = installationId;
  await SecureStore.setItemAsync(installationIdKey, installationId).catch(() => undefined);
  return installationId;
}

export async function getHiddenCreatorIds(): Promise<Set<string>> {
  let stored: string | null;
  try {
    stored = await SecureStore.getItemAsync(hiddenCreatorsKey);
  } catch {
    // Storefront content should remain available when the device keychain is
    // temporarily unavailable (for example after a device restore or while
    // running an unsigned simulator build). Hiding creators is a local-only
    // preference, so falling back to an empty set is safe.
    return new Set(fallbackHiddenCreatorIds);
  }
  if (!stored) return new Set(fallbackHiddenCreatorIds);
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set(fallbackHiddenCreatorIds);
    return new Set(
      parsed.filter((value): value is string => typeof value === 'string'),
    );
  } catch {
    return new Set(fallbackHiddenCreatorIds);
  }
}

export async function hideCreator(creatorId: string): Promise<void> {
  const hidden = await getHiddenCreatorIds();
  hidden.add(creatorId);
  fallbackHiddenCreatorIds = hidden;
  await SecureStore.setItemAsync(hiddenCreatorsKey, JSON.stringify([...hidden])).catch(
    () => undefined,
  );
}

export async function showCreator(creatorId: string): Promise<void> {
  const hidden = await getHiddenCreatorIds();
  hidden.delete(creatorId);
  fallbackHiddenCreatorIds = hidden;
  await SecureStore.setItemAsync(hiddenCreatorsKey, JSON.stringify([...hidden])).catch(
    () => undefined,
  );
}
