import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { problem } from '../api-problem.js';
import { parseApiConfig } from '../config.js';

const SIGNATURE_TOLERANCE_SECONDS = 300;

@Injectable()
export class RevenueCatWebhookVerifier {
  verify(input: {
    authorization: string | undefined;
    rawBody: Buffer | undefined;
    signature: string | undefined;
    timestampSeconds?: number;
  }): Buffer {
    const config = parseApiConfig(process.env);
    if (
      !config.revenueCatWebhookAuthorization ||
      !config.revenueCatWebhookSigningSecret
    ) {
      throw problem(
        503,
        'BILLING_WEBHOOK_NOT_CONFIGURED',
        'Billing webhook is not configured',
      );
    }
    if (!input.rawBody) {
      throw problem(400, 'RAW_BODY_REQUIRED', 'Raw webhook body is required');
    }
    if (
      !input.authorization ||
      !constantTimeEqual(input.authorization, config.revenueCatWebhookAuthorization)
    ) {
      throw problem(401, 'INVALID_WEBHOOK_AUTHORIZATION', 'Webhook authorization failed');
    }

    const signature = parseSignature(input.signature);
    const now = input.timestampSeconds ?? Math.floor(Date.now() / 1000);
    if (Math.abs(now - signature.timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
      throw problem(401, 'STALE_WEBHOOK_SIGNATURE', 'Webhook signature has expired');
    }

    const signedPayload = Buffer.concat([
      Buffer.from(`${signature.timestamp}.`, 'utf8'),
      input.rawBody,
    ]);
    const expected = createHmac('sha256', config.revenueCatWebhookSigningSecret)
      .update(signedPayload)
      .digest('hex');
    if (!constantTimeEqual(signature.digest, expected)) {
      throw problem(401, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature is invalid');
    }
    return input.rawBody;
  }
}

function parseSignature(value: string | undefined): {
  digest: string;
  timestamp: number;
} {
  const parts = new Map(
    (value ?? '').split(',').map((part) => {
      const separator = part.indexOf('=');
      return separator === -1
        ? [part.trim(), '']
        : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
    }),
  );
  const timestamp = Number(parts.get('t'));
  const digest = parts.get('v1') ?? '';
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp <= 0 ||
    !/^[a-f\d]{64}$/i.test(digest)
  ) {
    throw problem(401, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature is malformed');
  }
  return { digest: digest.toLowerCase(), timestamp };
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  return (
    leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
  );
}
