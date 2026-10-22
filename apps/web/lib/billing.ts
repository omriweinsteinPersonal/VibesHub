import { billingSummarySchema, type BillingSummary } from '@vibeshub/contracts';

import { ApiError, apiRequest } from './api';

export async function getBillingSummary(): Promise<BillingSummary> {
  const parsed = billingSummarySchema.safeParse(await apiRequest<unknown>('/billing'));
  if (!parsed.success) {
    throw new ApiError(
      'Subscription details could not be verified. Please try again.',
      502,
    );
  }
  return parsed.data;
}
