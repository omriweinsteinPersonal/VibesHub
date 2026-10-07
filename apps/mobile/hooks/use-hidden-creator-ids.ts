import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getHiddenCreatorIds } from '../lib/content-safety';

export function useHiddenCreatorIds(): ReadonlySet<string> {
  const [hiddenCreatorIds, setHiddenCreatorIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getHiddenCreatorIds().then((ids) => {
        if (active) setHiddenCreatorIds(ids);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return hiddenCreatorIds;
}
