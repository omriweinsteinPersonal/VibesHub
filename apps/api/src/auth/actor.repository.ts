import { Injectable } from '@nestjs/common';
import { capabilities, type Capability } from '@vibeshub/auth';

import { Database } from '../database.js';
import type { RequestActor, VerifiedIdentity } from './auth.types.js';

interface ActorRow {
  capabilities: string[];
  status: RequestActor['accountStatus'];
}

@Injectable()
export class ActorRepository {
  constructor(private readonly database: Database) {}

  async resolve(identity: VerifiedIdentity): Promise<RequestActor | null> {
    const [row] = await this.database.sql<ActorRow[]>`
      select
        u.status,
        coalesce(
          array_agg(uc.capability) filter (where uc.capability is not null),
          array[]::text[]
        ) as capabilities
      from app.users u
      left join app.user_capabilities uc on uc.user_id = u.id
      where u.id = ${identity.userId}
      group by u.id, u.status
    `;

    if (!row) return null;
    const allowed = new Set<string>(capabilities);
    const granted = new Set(
      row.capabilities.filter((capability): capability is Capability =>
        allowed.has(capability),
      ),
    );
    return { ...identity, accountStatus: row.status, capabilities: granted };
  }
}
