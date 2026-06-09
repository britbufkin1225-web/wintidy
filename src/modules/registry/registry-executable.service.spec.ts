import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RegistryExecutableService } from './registry-executable.service';

describe('RegistryExecutableService', () => {
  let directory: string;
  const service = new RegistryExecutableService();

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'wintidy-registry-'));
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  it('reports an existing absolute executable as healthy', async () => {
    const executable = join(directory, 'app.exe');
    await writeFile(executable, '');

    expect(service.assess(`"${executable}" --background`)).toEqual({
      status: 'healthy',
      executablePath: executable,
      reason: 'Executable exists',
    });
  });

  it('reports a missing absolute executable as orphaned', () => {
    const executable = join(directory, 'missing.exe');

    expect(service.assess(`"${executable}" --background`)).toEqual({
      status: 'orphaned',
      executablePath: executable,
      reason: 'Executable path does not exist',
    });
  });

  it('does not classify PATH commands or shell URIs as orphaned', () => {
    expect(service.assess('OneDrive.exe /background').status).toBe('ambiguous');
    expect(service.assess('shell:AppsFolder\\Example').status).toBe(
      'ambiguous',
    );
  });
});
