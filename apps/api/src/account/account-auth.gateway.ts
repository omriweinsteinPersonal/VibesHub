import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { parseApiConfig } from '../config.js';

@Injectable()
export class AccountAuthGateway {
  private readonly client: SupabaseClient | null;

  constructor() {
    const config = parseApiConfig(process.env);
    this.client =
      config.supabaseUrl && config.supabaseServiceRoleKey
        ? createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
            auth: {
              autoRefreshToken: false,
              detectSessionInUrl: false,
              persistSession: false,
            },
          })
        : null;
  }

  async deleteUser(userId: string): Promise<void> {
    if (!this.client) throw new Error('Account deletion is not configured');

    const { error } = await this.client.auth.admin.deleteUser(userId, false);
    if (error) throw new Error(`Account deletion failed: ${error.message}`);
  }
}
