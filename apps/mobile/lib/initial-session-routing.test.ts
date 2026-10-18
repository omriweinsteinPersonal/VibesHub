import { describe, expect, it } from 'vitest';

import { createInitialSessionRedirectGate } from './initial-session-routing';

describe('initial creator session routing', () => {
  it('restores a persisted session once when the application launches', () => {
    const gate = createInitialSessionRedirectGate();

    expect(gate.isPending()).toBe(true);
    expect(gate.consume(true)).toBe(true);
    expect(gate.isPending()).toBe(false);
    expect(gate.consume(true)).toBe(false);
  });

  it('does not redirect a signed-out launch later in the same process', () => {
    const gate = createInitialSessionRedirectGate();

    expect(gate.consume(false)).toBe(false);
    expect(gate.consume(true)).toBe(false);
  });
});
