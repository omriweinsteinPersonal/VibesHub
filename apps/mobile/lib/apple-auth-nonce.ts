import * as Crypto from 'expo-crypto';

export type AppleAuthNonce = {
  hashed: string;
  raw: string;
};

export async function createAppleAuthNonce(): Promise<AppleAuthNonce> {
  const raw = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);

  return { hashed, raw };
}
