import { Injectable } from '@nestjs/common';
import type {
  AccountProfile,
  AccountProfilePatch,
  CreatorApplicationStatus,
} from '@vibeshub/contracts';

import { Database } from '../database.js';
import type { RequestActor } from '../auth/auth.types.js';

interface AccountProfileRow {
  displayName: string;
  interfaceLocale: 'en' | 'he';
  timezone: string;
  version: number;
}

interface AccountSummaryRow extends AccountProfileRow {
  applicationId: string | null;
  applicationStatus: CreatorApplicationStatus | null;
  creatorHandle: string | null;
  creatorId: string | null;
}

export interface AccountSummary {
  application: { id: string; status: CreatorApplicationStatus } | null;
  capabilities: string[];
  creator: { handle: string; id: string } | null;
  email?: string;
  id: string;
  profile: AccountProfile;
}

@Injectable()
export class AccountRepository {
  constructor(private readonly database: Database) {}

  async getSummary(actor: RequestActor): Promise<AccountSummary> {
    const [row] = await this.database.sql<AccountSummaryRow[]>`
      select
        p.display_name as "displayName",
        p.interface_locale as "interfaceLocale",
        p.timezone,
        p.version,
        a.id as "applicationId",
        a.status as "applicationStatus",
        c.id as "creatorId",
        c.handle::text as "creatorHandle"
      from app.user_profiles p
      left join app.creator_applications a on a.user_id = p.user_id
      left join app.creator_profiles c on c.user_id = p.user_id
      where p.user_id = ${actor.userId}
    `;
    if (!row) throw new Error('Account profile is missing');

    const summary: AccountSummary = {
      application:
        row.applicationId && row.applicationStatus
          ? { id: row.applicationId, status: row.applicationStatus }
          : null,
      capabilities: [...actor.capabilities].sort(),
      creator:
        row.creatorId && row.creatorHandle
          ? { handle: row.creatorHandle, id: row.creatorId }
          : null,
      id: actor.userId,
      profile: {
        displayName: row.displayName,
        interfaceLocale: row.interfaceLocale,
        timezone: row.timezone,
        version: row.version,
      },
    };
    if (actor.email) summary.email = actor.email;
    return summary;
  }

  async getProfile(userId: string): Promise<AccountProfile> {
    const [row] = await this.database.sql<AccountProfileRow[]>`
      select
        display_name as "displayName",
        interface_locale as "interfaceLocale",
        timezone,
        version
      from app.user_profiles
      where user_id = ${userId}
    `;
    if (!row) throw new Error('Account profile is missing');
    return row;
  }

  async updateProfile(
    userId: string,
    patch: AccountProfilePatch,
  ): Promise<AccountProfile> {
    const [row] = await this.database.sql<AccountProfileRow[]>`
      update app.user_profiles
      set
        display_name = coalesce(${patch.displayName ?? null}, display_name),
        interface_locale = coalesce(${patch.interfaceLocale ?? null}, interface_locale),
        timezone = coalesce(${patch.timezone ?? null}, timezone),
        version = version + 1
      where user_id = ${userId}
      returning
        display_name as "displayName",
        interface_locale as "interfaceLocale",
        timezone,
        version
    `;
    if (!row) throw new Error('Account profile is missing');
    return row;
  }
}
