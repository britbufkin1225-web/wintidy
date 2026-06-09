import {
  BadRequestException,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import {
  WalkError,
  WalkedFile,
  walkFiles,
} from '../../common/filesystem/safe-file-walker';

interface DuplicateFile {
  path: string;
  size: number;
}

interface DuplicateGroup {
  hash: string;
  size: number;
  reclaimableBytes: number;
  files: DuplicateFile[];
}

export interface DuplicateScanResult {
  root: string;
  filesScanned: number;
  candidateFilesHashed: number;
  duplicateGroups: DuplicateGroup[];
  duplicateFiles: number;
  reclaimableBytes: number;
  truncated: boolean;
  errors: WalkError[];
  scannedAt: string;
}

const MAX_FILES = 100_000;

@Injectable()
export class DuplicatesService {
  async findDuplicates(requestedPath: string): Promise<DuplicateScanResult> {
    if (!isAbsolute(requestedPath)) {
      throw new BadRequestException('path must be an absolute filesystem path');
    }

    const root = resolve(requestedPath);
    let rootStats;
    try {
      rootStats = await stat(root);
    } catch {
      throw new BadRequestException('path does not exist or is not accessible');
    }

    if (!rootStats.isDirectory()) {
      throw new BadRequestException('path must identify a directory');
    }

    const walked = await walkFiles(root, { maxFiles: MAX_FILES });
    if (walked.truncated) {
      throw new PayloadTooLargeException(
        `Scan exceeded the ${MAX_FILES.toLocaleString()} file safety limit`,
      );
    }

    const sizeGroups = this.groupBySize(walked.files);
    const candidateGroups = [...sizeGroups.values()].filter(
      (files) => files.length > 1,
    );
    const hashGroups = new Map<string, WalkedFile[]>();
    let candidateFilesHashed = 0;

    for (const files of candidateGroups) {
      for (const file of files) {
        try {
          const hash = await this.hashFile(file.path);
          candidateFilesHashed += 1;
          const key = `${file.size}:${hash}`;
          const matches = hashGroups.get(key) ?? [];
          matches.push(file);
          hashGroups.set(key, matches);
        } catch (error) {
          walked.errors.push({
            path: file.path,
            message:
              error instanceof Error ? error.message : 'Unable to hash file',
          });
        }
      }
    }

    const duplicateGroups = [...hashGroups.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([key, files]) => {
        const separator = key.indexOf(':');
        const hash = key.slice(separator + 1);
        const size = files[0].size;
        return {
          hash,
          size,
          reclaimableBytes: size * (files.length - 1),
          files: files.map((file) => ({ path: file.path, size: file.size })),
        };
      })
      .sort((left, right) => right.reclaimableBytes - left.reclaimableBytes);

    return {
      root,
      filesScanned: walked.files.length,
      candidateFilesHashed,
      duplicateGroups,
      duplicateFiles: duplicateGroups.reduce(
        (total, group) => total + group.files.length,
        0,
      ),
      reclaimableBytes: duplicateGroups.reduce(
        (total, group) => total + group.reclaimableBytes,
        0,
      ),
      truncated: walked.truncated,
      errors: walked.errors,
      scannedAt: new Date().toISOString(),
    };
  }

  private groupBySize(files: WalkedFile[]): Map<number, WalkedFile[]> {
    const groups = new Map<number, WalkedFile[]>();
    for (const file of files) {
      const matches = groups.get(file.size) ?? [];
      matches.push(file);
      groups.set(file.size, matches);
    }
    return groups;
  }

  private hashFile(path: string): Promise<string> {
    return new Promise((resolveHash, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(path);
      stream.on('error', reject);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolveHash(hash.digest('hex')));
    });
  }
}
