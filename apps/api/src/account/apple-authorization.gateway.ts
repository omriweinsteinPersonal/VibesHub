import { createPrivateKey, sign } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { parseApiConfig } from '../config.js';

const tokenResponseSchema = z.object({
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
});

interface AppleAuthorizationConfig {
  clientId: string;
  keyId: string;
  privateKey: string;
  teamId: string;
}

@Injectable()
export class AppleAuthorizationGateway {
  private readonly config: AppleAuthorizationConfig | null;

  constructor() {
    const config = parseApiConfig(process.env);
    this.config =
      config.appleClientId &&
      config.appleKeyId &&
      config.applePrivateKey &&
      config.appleTeamId
        ? {
            clientId: config.appleClientId,
            keyId: config.appleKeyId,
            privateKey: config.applePrivateKey,
            teamId: config.appleTeamId,
          }
        : null;
  }

  async revokeAuthorizationCode(authorizationCode: string): Promise<void> {
    if (!this.config) {
      throw new Error('Apple account revocation is not configured');
    }

    const clientSecret = createClientSecret(this.config);
    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: clientSecret,
        code: authorizationCode,
        grant_type: 'authorization_code',
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
    const tokenBody: unknown = await tokenResponse.json().catch(() => null);
    if (!tokenResponse.ok) {
      throw new Error(`Apple authorization exchange failed (${tokenResponse.status})`);
    }
    const tokens = tokenResponseSchema.parse(tokenBody);
    const token = tokens.refresh_token ?? tokens.access_token;
    if (!token) throw new Error('Apple did not return a revocable token');

    const revokeResponse = await fetch('https://appleid.apple.com/auth/revoke', {
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: clientSecret,
        token,
        token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token',
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
    if (!revokeResponse.ok) {
      throw new Error(`Apple authorization revocation failed (${revokeResponse.status})`);
    }
  }
}

function createClientSecret(config: AppleAuthorizationConfig): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJson({ alg: 'ES256', kid: config.keyId, typ: 'JWT' });
  const claims = encodeJson({
    aud: 'https://appleid.apple.com',
    exp: now + 300,
    iat: now,
    iss: config.teamId,
    sub: config.clientId,
  });
  const signingInput = `${header}.${claims}`;
  const signature = sign('sha256', Buffer.from(signingInput), {
    dsaEncoding: 'ieee-p1363',
    key: createPrivateKey(config.privateKey),
  });
  return `${signingInput}.${signature.toString('base64url')}`;
}

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
