import { describe, expect, it, vi } from 'vitest';

import { ReportService } from './report.service.js';

const input = {
  installationId: 'c6097891-5c25-4ef9-94f0-28f78d7ee067',
  reason: 'misleading' as const,
  targetId: 'b251959e-ab9e-4a09-bf3c-2dd80d43631a',
  targetType: 'recommendation' as const,
};

describe('ReportService', () => {
  it('returns the moderation receipt', async () => {
    const receipt = {
      id: 'e7e7c5e2-7471-4035-9399-eb60a0ded5a1',
      status: 'received' as const,
    };
    const repository = { create: vi.fn().mockResolvedValue(receipt) };
    const service = new ReportService(repository as never);

    await expect(service.create(input)).resolves.toEqual(receipt);
    expect(repository.create).toHaveBeenCalledWith(input);
  });

  it('does not accept reports for unavailable public content', async () => {
    const repository = { create: vi.fn().mockResolvedValue(null) };
    const service = new ReportService(repository as never);

    await expect(service.create(input)).rejects.toMatchObject({ status: 404 });
  });
});
