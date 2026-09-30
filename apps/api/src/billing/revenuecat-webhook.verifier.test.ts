import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RevenueCatWebhookVerifier } from './revenuecat-webhook.verifier.js';

const authorization = 'Bearer sandbox-webhook-secret';
const signingSecret = 'sandbox-signing-secret';
const timestamp = 1_800_000_000;
const rawBody = Buffer.from('{"event":{"id":"event-1"}}', 'utf8');

afterEach(() => vi.unstubAllEnvs());

describe('RevenueCatWebhookVerifier', () => {
  it('accepts a current HMAC signature and matching authorization', () => {
    configureSecrets();
    const verifier = new RevenueCatWebhookVerifier();

    expect(
      verifier.verify({
        authorization,
        rawBody,
        signature: signatureFor(rawBody),
        timestampSeconds: timestamp,
      }),
    ).toEqual(rawBody);
  });

  it('rejects an invalid signature before parsing the payload', () => {
    configureSecrets();
    const verifier = new RevenueCatWebhookVerifier();

    expect(
      problemCode(() =>
        verifier.verify({
          authorization,
          rawBody,
          signature: `t=${timestamp},v1=${'0'.repeat(64)}`,
          timestampSeconds: timestamp,
        }),
      ),
    ).toBe('INVALID_WEBHOOK_SIGNATURE');
  });

  it('rejects stale signatures to limit replay attacks', () => {
    configureSecrets();
    const verifier = new RevenueCatWebhookVerifier();

    expect(
      problemCode(() =>
        verifier.verify({
          authorization,
          rawBody,
          signature: signatureFor(rawBody),
          timestampSeconds: timestamp + 301,
        }),
      ),
    ).toBe('STALE_WEBHOOK_SIGNATURE');
  });
});

function configureSecrets(): void {
  vi.stubEnv('REVENUECAT_WEBHOOK_AUTHORIZATION', authorization);
  vi.stubEnv('REVENUECAT_WEBHOOK_SIGNING_SECRET', signingSecret);
}

function signatureFor(body: Buffer): string {
  const digest = createHmac('sha256', signingSecret)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`), body]))
    .digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

function problemCode(run: () => unknown): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined;
    const response = error.response;
    if (!response || typeof response !== 'object' || !('code' in response))
      return undefined;
    return typeof response.code === 'string' ? response.code : undefined;
  }
}
