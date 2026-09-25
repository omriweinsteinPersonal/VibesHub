export interface AuthenticatedAccount {
  capabilities: string[];
  creator: { handle: string; id: string } | null;
}

const operatorCapabilities = new Set([
  'admin:manage_platform',
  'moderator:review_content',
]);

export function safeInternalPath(value: string | null, fallback: string): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return fallback;
  }

  return value;
}

export function destinationForAccount(
  account: AuthenticatedAccount,
  requestedNext: string,
): string {
  if (account.creator) {
    return requestedNext === '/creator/apply' ? '/creator-home' : requestedNext;
  }

  return account.capabilities.some((capability) => operatorCapabilities.has(capability))
    ? '/admin/applications'
    : '/creator/apply';
}
