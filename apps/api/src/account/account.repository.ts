import { Injectable } from '@nestjs/common';
import type { CreatorApplicationStatus } from '@vibeshub/contracts';

import { Database } from '../database.js';
import type { RequestActor } from '../auth/auth.types.js';

interface AccountSummaryRow {
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
}

@Injectable()
export class AccountRepository {
  constructor(private readonly database: Database) {}

  async getSummary(actor: RequestActor): Promise<AccountSummary> {
    const [row] = await this.database.sql<AccountSummaryRow[]>`
      select
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
    };
    if (actor.email) summary.email = actor.email;
    return summary;
  }
}
