import { Injectable } from '@nestjs/common';

import { Database, type DatabaseClient } from '../database.js';

export interface MerchantDomainInput {
  allowImport: boolean;
  allowRedirect: boolean;
  hostname: string;
}

export interface MerchantDomainRecord extends MerchantDomainInput {
  id: string;
  merchantId: string;
  updatedAt: string;
  verifiedAt: string | null;
  version: number;
}

@Injectable()
export class MerchantDomainRepository {
  constructor(private readonly database: Database) {}

  async upsert(
    merchantId: string,
    actorUserId: string,
    input: MerchantDomainInput,
  ): Promise<MerchantDomainRecord | null> {
    return this.database.sql.begin(async (transaction) => {
      const sql = transaction as unknown as DatabaseClient;
      const [merchant] = await sql<{ id: string }[]>`
        select id from app.merchants where id = ${merchantId}
      `;
      if (!merchant) return null;

      const [domain] = await sql<MerchantDomainRecord[]>`
        insert into app.merchant_domains (
          merchant_id,
          hostname,
          allow_import,
          allow_redirect,
          verified_at
        ) values (
          ${merchantId},
          ${input.hostname},
          ${input.allowImport},
          ${input.allowRedirect},
          ${input.allowImport || input.allowRedirect ? new Date() : null}
        )
        on conflict (hostname) do update
        set
          allow_import = excluded.allow_import,
          allow_redirect = excluded.allow_redirect,
          verified_at = case
            when excluded.allow_import or excluded.allow_redirect
              then coalesce(app.merchant_domains.verified_at, statement_timestamp())
            else app.merchant_domains.verified_at
          end,
          version = app.merchant_domains.version + 1
        where app.merchant_domains.merchant_id = excluded.merchant_id
        returning
          id,
          merchant_id as "merchantId",
          hostname::text as hostname,
          allow_import as "allowImport",
          allow_redirect as "allowRedirect",
          verified_at::text as "verifiedAt",
          updated_at::text as "updatedAt",
          version
      `;
      if (!domain) throw new Error('MERCHANT_DOMAIN_CONFLICT');

      await sql`
        insert into audit.entries (
          actor_user_id,
          action,
          target_type,
          target_id,
          metadata
        ) values (
          ${actorUserId},
          'merchant_domain.permissions_changed',
          'merchant_domain',
          ${domain.id},
          ${JSON.stringify({
            allowImport: domain.allowImport,
            allowRedirect: domain.allowRedirect,
            hostname: domain.hostname,
            merchantId,
          })}::jsonb
        )
      `;
      return domain;
    });
  }
}
