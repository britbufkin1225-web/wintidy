import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DuplicatesService } from './duplicates.service';

describe('DuplicatesService', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'wintidy-duplicates-'));
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it('hashes only size candidates and returns duplicate groups', async () => {
    await Promise.all([
      writeFile(join(root, 'first.txt'), 'same-content'),
      writeFile(join(root, 'second.txt'), 'same-content'),
      writeFile(join(root, 'different.txt'), 'different'),
    ]);

    const result = await new DuplicatesService().findDuplicates(root);

    expect(result.filesScanned).toBe(3);
    expect(result.duplicateGroups).toHaveLength(1);
    expect(result.duplicateGroups[0].files).toHaveLength(2);
    expect(result.reclaimableBytes).toBe(Buffer.byteLength('same-content'));
  });

  it('rejects relative paths', async () => {
    await expect(
      new DuplicatesService().findDuplicates('relative-folder'),
    ).rejects.toThrow('absolute filesystem path');
  });
});
