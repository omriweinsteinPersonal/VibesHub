'use client';

import { useSyncExternalStore } from 'react';
import { CreatorShellHeader } from './creator-shell-header';

const subscribe = () => () => {};
const isEmbedded = () => window.self !== window.top;

export function StorefrontHeader({
  creatorSession,
  workspace = false,
}: {
  creatorSession: boolean;
  workspace?: boolean;
}) {
  const embedded = useSyncExternalStore(subscribe, isEmbedded, () => false);
  if (embedded || !creatorSession) {
    return null;
  }
  return (
    <div className={workspace ? 'storefrontWorkspaceHeader' : 'storefrontDetailHeader'}>
      <CreatorShellHeader homeLogo={workspace} showBottomBar={false} />
    </div>
  );
}
