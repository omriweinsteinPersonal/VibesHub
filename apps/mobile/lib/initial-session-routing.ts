export interface InitialSessionRedirectGate {
  consume(hasSession: boolean): boolean;
  isPending(): boolean;
}

export function createInitialSessionRedirectGate(): InitialSessionRedirectGate {
  let pending = true;

  return {
    consume(hasSession) {
      if (!pending) return false;
      pending = false;
      return hasSession;
    },
    isPending() {
      return pending;
    },
  };
}

/**
 * This module-level gate is intentionally reset when the native process restarts. It
 * restores an existing creator session once at launch without trapping signed-in
 * creators who later navigate back to the public discovery screen.
 */
export const initialSessionRedirectGate = createInitialSessionRedirectGate();
