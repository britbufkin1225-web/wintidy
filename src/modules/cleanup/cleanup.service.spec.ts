import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../../database/prisma.service';
import { CleanupCategory } from './cleanup-category';
import { CleanupRootsService } from './cleanup-roots.service';
import { CleanupService } from './cleanup.service';

describe('CleanupService', () => {
  let root: string;
  let service: CleanupService;
  const maintenanceRun = {
    create: jest.fn(),
    update: jest.fn(),
  };
  const cleanupFinding = {
    createMany: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    root = await mkdtemp(join(tmpdir(), 'wintidy-cleanup-'));
    const roots = {
      getRootsFor: jest.fn().mockReturnValue([
        {
          category: CleanupCategory.UserTemp,
          label: 'Test temporary files',
          path: root,
        },
      ]),
    } as unknown as CleanupRootsService;
    const prisma = {
      maintenanceRun,
      cleanupFinding,
    } as unknown as PrismaService;
    service = new CleanupService(roots, prisma);
    maintenanceRun.create.mockResolvedValue({ id: 42 });
    maintenanceRun.update.mockResolvedValue({ id: 42 });
    cleanupFinding.createMany.mockResolvedValue({ count: 1 });
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it('previews files without deleting them', async () => {
    const filePath = join(root, 'preview.tmp');
    await writeFile(filePath, 'preview');

    const result = await service.preview([CleanupCategory.UserTemp]);

    expect(result.fileCount).toBe(1);
    expect(await readFile(filePath, 'utf8')).toBe('preview');
    expect(maintenanceRun.create).not.toHaveBeenCalled();
  });

  it('deletes discovered files and records a maintenance run', async () => {
    const filePath = join(root, 'delete.tmp');
    await writeFile(filePath, 'delete-me');

    const result = await service.run([CleanupCategory.UserTemp]);

    expect(result.status).toBe('completed');
    expect(result.filesDeleted).toBe(1);
    expect(result.bytesFreed).toBe(Buffer.byteLength('delete-me'));
    expect(maintenanceRun.create).toHaveBeenCalledWith({
      data: {
        status: 'running',
        requestedCategories: [CleanupCategory.UserTemp],
        confirmationReceived: true,
      },
    });
    expect(maintenanceRun.update).toHaveBeenCalled();
    await expect(readFile(filePath)).rejects.toThrow();
  });
});
