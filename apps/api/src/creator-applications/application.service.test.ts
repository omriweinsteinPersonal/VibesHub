import { describe, expect, it, vi } from 'vitest';

import { ApplicationService } from './application.service.js';

describe('ApplicationService handle availability', () => {
  it('checks a suggested handle before an application exists', async () => {
    const repository = {
      findCurrent: vi.fn().mockResolvedValue(null),
      isHandleAvailable: vi.fn().mockResolvedValue(true),
    };
    const service = new ApplicationService(repository as never);

    await expect(service.handleAvailability('user-id', 'noa-levi')).resolves.toEqual({
      available: true,
      handle: 'noa-levi',
    });
    expect(repository.isHandleAvailable).toHaveBeenCalledWith('noa-levi', undefined);
  });

  it('excludes the creator own draft while checking an edited handle', async () => {
    const repository = {
      findCurrent: vi.fn().mockResolvedValue({ id: 'application-id' }),
      isHandleAvailable: vi.fn().mockResolvedValue(false),
    };
    const service = new ApplicationService(repository as never);

    await expect(service.handleAvailability('user-id', 'taken')).resolves.toEqual({
      available: false,
      handle: 'taken',
    });
    expect(repository.isHandleAvailable).toHaveBeenCalledWith('taken', 'application-id');
  });
});
