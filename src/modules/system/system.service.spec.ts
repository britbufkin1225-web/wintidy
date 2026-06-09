import { SystemService } from './system.service';

describe('SystemService', () => {
  it('returns a complete health snapshot', async () => {
    const health = await new SystemService().getHealth();

    expect(health.hostname).toBeTruthy();
    expect(health.platform).toBeTruthy();
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(health.cpu.logicalCores).toBeGreaterThan(0);
    expect(health.cpu.loadPercent).toBeGreaterThanOrEqual(0);
    expect(health.cpu.loadPercent).toBeLessThanOrEqual(100);
    expect(health.memory.totalBytes).toBeGreaterThan(0);
    expect(health.disk.totalBytes).toBeGreaterThan(0);
    expect(new Date(health.observedAt).toString()).not.toBe('Invalid Date');
  });
});
