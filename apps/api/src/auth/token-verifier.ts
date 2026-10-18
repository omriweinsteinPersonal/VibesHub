import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { parseApiConfig } from '../config.js';
import type { VerifiedIdentity } from './auth.types.js';

const claimsSchema = z.object({
  app_metadata: z
    .object({
      provider: z.string().optional(),
      providers: z.array(z.string()).optional(),
    })
    .optional(),
  email: z.string().email().optional(),
  role: z.literal('authenticated'),
  sub: z.uuid(),
});

interface TokenVerifier {
  verify(accessToken: string): Promise<VerifiedIdentity | null>;
}

@Injectable()
export class SupabaseTokenVerifier implements TokenVerifier {
  private readonly client: SupabaseClient | null;

  constructor() {
    const config = parseApiConfig(process.env);
    this.client =
      config.supabaseUrl && config.supabasePublishableKey
        ? createClient(config.supabaseUrl, config.supabasePublishableKey, {
            auth: {
              autoRefreshToken: false,
              detectSessionInUrl: false,
              persistSession: false,
            },
          })
        : null;
  }

  async verify(accessToken: string): Promise<VerifiedIdentity | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.getClaims(accessToken);
    if (error || !data) return null;
    const parsed = claimsSchema.safeParse(data.claims);
    if (!parsed.success) return null;
    const identity: VerifiedIdentity = { userId: parsed.data.sub };
    if (parsed.data.email) identity.email = parsed.data.email;
    const providers =
      parsed.data.app_metadata?.providers ??
      (parsed.data.app_metadata?.provider ? [parsed.data.app_metadata.provider] : []);
    if (providers.length > 0) identity.providers = providers;
    return identity;
  }
}
