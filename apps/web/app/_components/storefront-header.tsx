'use client';

import { useSyncExternalStore } from 'react';
import { Brand } from './brand';
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
    return (
      <header className="creatorShellHeader storefrontVisitorHeader">
        <div className="creatorShellHeaderInner">
          <Brand />
        </div>
      </header>
    );
  }
  return (
    <div className={workspace ? 'storefrontWorkspaceHeader' : 'storefrontDetailHeader'}>
      <CreatorShellHeader />
    </div>
  );
}
