import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { problem } from '../api-problem.js';
import { parseApiConfig } from '../config.js';
import { BillingRepository, type WebhookProcessingResult } from './billing.repository.js';
import { revenueCatWebhookSchema, type BillingSummary } from './billing.types.js';
import { RevenueCatWebhookVerifier } from './revenuecat-webhook.verifier.js';

@Injectable()
export class BillingService {
  constructor(
    private readonly billing: BillingRepository,
    private readonly verifier: RevenueCatWebhookVerifier,
  ) {}

  getSummary(userId: string): Promise<BillingSummary> {
    return this.billing.getSummary(userId);
  }

  async handleRevenueCatWebhook(input: {
    authorization: string | undefined;
    rawBody: Buffer | undefined;
    signature: string | undefined;
  }): Promise<WebhookProcessingResult> {
    const rawBody = this.verifier.verify(input);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw problem(400, 'INVALID_WEBHOOK_BODY', 'Webhook body is not valid JSON');
    }

    try {
      const payload = revenueCatWebhookSchema.parse(parsedJson);
      const config = parseApiConfig(process.env);
      return await this.billing.processRevenueCatEvent({
        allowedEnvironment: config.revenueCatAllowedEnvironment,
        entitlementId: config.revenueCatEntitlementId,
        event: payload.event,
        rawBody,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw problem(400, 'INVALID_WEBHOOK_BODY', 'Webhook body has an invalid shape');
      }
      throw error;
    }
  }
}
