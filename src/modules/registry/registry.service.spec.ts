import { PrismaService } from '../../database/prisma.service';
import { RegistryBackupService } from './registry-backup.service';
import {
  RegistryCommandService,
  RegistryValue,
} from './registry-command.service';
import { RegistryExecutableService } from './registry-executable.service';
import { RegistryStartupKey } from './registry-key';
import { RegistryService } from './registry.service';

describe('RegistryService', () => {
  const orphanedValue: RegistryValue = {
    key: RegistryStartupKey.CurrentUserRun,
    valueName: 'Missing App',
    valueType: 'REG_SZ',
    data: '"C:\\Missing\\app.exe" --background',
  };
  const commands = {
    queryKey: jest.fn(),
    queryValue: jest.fn(),
    deleteValue: jest.fn(),
  };
  const executables = {
    assess: jest.fn(),
  };
  const backups = {
    backup: jest.fn(),
  };
  const registryMaintenanceRun = {
    create: jest.fn(),
    update: jest.fn(),
  };
  let service: RegistryService;

  beforeEach(() => {
    jest.clearAllMocks();
    commands.queryValue.mockResolvedValue(orphanedValue);
    commands.deleteValue.mockResolvedValue(undefined);
    executables.assess.mockReturnValue({
      status: 'orphaned',
      executablePath: 'C:\\Missing\\app.exe',
      reason: 'Executable path does not exist',
    });
    backups.backup.mockResolvedValue(
      'C:\\WinTidy\\data\\registry-backups\\1-1-Missing_App.reg',
    );
    registryMaintenanceRun.create.mockResolvedValue({ id: 1 });
    registryMaintenanceRun.update.mockResolvedValue({ id: 1 });
    service = new RegistryService(
      commands as unknown as RegistryCommandService,
      executables as unknown as RegistryExecutableService,
      backups as unknown as RegistryBackupService,
      { registryMaintenanceRun } as unknown as PrismaService,
    );
  });

  it('previews orphaned targets without deleting or backing up', async () => {
    const result = await service.preview([
      {
        key: RegistryStartupKey.CurrentUserRun,
        valueName: 'Missing App',
      },
    ]);

    expect(result.removableCount).toBe(1);
    expect(commands.deleteValue).not.toHaveBeenCalled();
    expect(backups.backup).not.toHaveBeenCalled();
  });

  it('backs up before deleting the exact orphaned value and audits the run', async () => {
    const target = {
      key: RegistryStartupKey.CurrentUserRun,
      valueName: 'Missing App',
    };
    const result = await service.run([target]);

    expect(result.entriesRemoved).toBe(1);
    expect(backups.backup).toHaveBeenCalledWith(1, 0, {
      ...orphanedValue,
      status: 'orphaned',
      executablePath: 'C:\\Missing\\app.exe',
      reason: 'Executable path does not exist',
    });
    expect(commands.deleteValue).toHaveBeenCalledWith(
      RegistryStartupKey.CurrentUserRun,
      'Missing App',
    );
    expect(backups.backup.mock.invocationCallOrder[0]).toBeLessThan(
      commands.deleteValue.mock.invocationCallOrder[0],
    );
    expect(registryMaintenanceRun.update).toHaveBeenCalled();
  });

  it('skips a target that is no longer orphaned', async () => {
    executables.assess.mockReturnValue({
      status: 'healthy',
      executablePath: 'C:\\Existing\\app.exe',
      reason: 'Executable exists',
    });

    const result = await service.run([
      {
        key: RegistryStartupKey.CurrentUserRun,
        valueName: 'Missing App',
      },
    ]);

    expect(result.entriesRemoved).toBe(0);
    expect(result.skippedEntries).toBe(1);
    expect(commands.deleteValue).not.toHaveBeenCalled();
  });

  it('skips deletion when the value changes after backup', async () => {
    commands.queryValue
      .mockResolvedValueOnce(orphanedValue)
      .mockResolvedValueOnce({
        ...orphanedValue,
        data: '"C:\\Different\\app.exe"',
      });

    const result = await service.run([
      {
        key: RegistryStartupKey.CurrentUserRun,
        valueName: 'Missing App',
      },
    ]);

    expect(result.entriesRemoved).toBe(0);
    expect(result.skippedEntries).toBe(1);
    expect(backups.backup).toHaveBeenCalled();
    expect(commands.deleteValue).not.toHaveBeenCalled();
  });
});
