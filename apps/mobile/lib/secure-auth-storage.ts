const CHUNK_SIZE = 1_800;

export interface NativeKeyValueStore {
  deleteItemAsync(key: string): Promise<void>;
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

function chunkKey(key: string, suffix: string | number): string {
  return `${key}.${suffix}`;
}

export function createSecureAuthStorage(
  nativeStore: NativeKeyValueStore,
  developmentFallback?: Map<string, string>,
) {
  const storage = {
    async getItem(key: string): Promise<string | null> {
      try {
        const countValue = await nativeStore.getItemAsync(chunkKey(key, 'count'));
        if (!countValue) return nativeStore.getItemAsync(key);
        const count = Number(countValue);
        const chunks = await Promise.all(
          Array.from({ length: count }, (_, index) =>
            nativeStore.getItemAsync(chunkKey(key, index)),
          ),
        );
        return chunks.every((chunk) => chunk !== null) ? chunks.join('') : null;
      } catch (cause) {
        if (developmentFallback) return developmentFallback.get(key) ?? null;
        throw cause;
      }
    },
    async removeItem(key: string): Promise<void> {
      try {
        const countValue = await nativeStore.getItemAsync(chunkKey(key, 'count'));
        const count = Number(countValue ?? 0);
        await Promise.all([
          nativeStore.deleteItemAsync(key),
          nativeStore.deleteItemAsync(chunkKey(key, 'count')),
          ...Array.from({ length: count }, (_, index) =>
            nativeStore.deleteItemAsync(chunkKey(key, index)),
          ),
        ]);
      } catch (cause) {
        if (!developmentFallback) throw cause;
      } finally {
        developmentFallback?.delete(key);
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        await storage.removeItem(key);
        const chunks = Array.from(
          { length: Math.ceil(value.length / CHUNK_SIZE) },
          (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
        );
        await Promise.all(
          chunks.map((chunk, index) =>
            nativeStore.setItemAsync(chunkKey(key, index), chunk),
          ),
        );
        await nativeStore.setItemAsync(chunkKey(key, 'count'), String(chunks.length));
      } catch (cause) {
        if (!developmentFallback) throw cause;
        developmentFallback.set(key, value);
      }
    },
  };

  return storage;
}
