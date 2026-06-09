import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { lstat, realpath, unlink } from 'node:fs/promises';
import {
  isPathInside,
  WalkError,
  walkFiles,
} from '../../common/filesystem/safe-file-walker';
import { PrismaService } from '../../database/prisma.service';
import { CleanupCategory } from './cleanup-category';
import { CleanupRoot, CleanupRootsService } from './cleanup-roots.service';

interface CategorySummary {
  category: CleanupCategory;
  fileCount: number;
  totalBytes: number;
  roots: RootSummary[];
}

interface RootSummary {
  label: string;
  path: string;
  fileCount: number;
  totalBytes: number;
  truncated: boolean;
  errors: WalkError[];
}

export interface CleanupScanResult {
  fileCount: number;
  totalBytes: number;
  categories: CategorySummary[];
  scannedAt: string;
}

export interface CleanupRunResult {
  maintenanceRunId: number;
  status: 'completed' | 'completed-with-errors' | 'failed';
  filesDeleted: number;
  bytesFreed: number;
  skippedFiles: number;
  errors: WalkError[];
  completedAt: string;
}

interface ScannedRoot {
  root: CleanupRoot;
  rootRealPath: string;
  summary: RootSummary;
  files: Awaited<ReturnType<typeof walkFiles>>['files'];
}

@Injectable()
export class CleanupService {
  private cleanupInProgress = false;

  constructor(
    private readonly cleanupRoots: CleanupRootsService,
    private readonly prisma: PrismaService,
  ) {}

  async scan(
    categories: CleanupCategory[] = Object.values(CleanupCategory),
    persist = true,
  ): Promise<CleanupScanResult> {
    const roots = this.cleanupRoots.getRootsFor(categories);
    const scannedRoots = await Promise.all(
      roots.map((root) => this.scanRoot(root)),
    );
    const result = this.summarize(scannedRoots, categories);

    if (persist && result.categories.length > 0) {
      await this.prisma.cleanupFinding.createMany({
        data: result.categories.map((category) => ({
          category: category.category,
          path: category.roots.map((root) => root.path).join(';'),
          fileCount: category.fileCount,
          totalBytes: BigInt(category.totalBytes),
        })),
      });
    }

    return result;
  }

  async preview(categories: CleanupCategory[]): Promise<CleanupScanResult> {
    return this.scan(categories, false);
  }

  async run(categories: CleanupCategory[]): Promise<CleanupRunResult> {
    if (this.cleanupInProgress) {
      throw new ConflictException('A cleanup run is already in progress');
    }

    this.cleanupInProgress = true;
    try {
      return await this.performRun(categories);
    } finally {
      this.cleanupInProgress = false;
    }
  }

  private async performRun(
    categories: CleanupCategory[],
  ): Promise<CleanupRunResult> {
    const maintenanceRun = await this.prisma.maintenanceRun.create({
      data: {
        status: 'running',
        requestedCategories: categories,
        confirmationReceived: true,
      },
    });
    const errors: WalkError[] = [];
    let filesDeleted = 0;
    let bytesFreed = 0;
    let skippedFiles = 0;

    try {
      const roots = this.cleanupRoots.getRootsFor(categories);
      for (const root of roots) {
        const scanned = await this.scanRoot(root);
        errors.push(...scanned.summary.errors);
        skippedFiles += scanned.summary.errors.length;

        for (const file of scanned.files) {
          try {
            const currentStats = await lstat(file.path);
            if (
              !currentStats.isFile() ||
              currentStats.isSymbolicLink() ||
              currentStats.size !== file.size ||
              currentStats.mtimeMs !== file.modifiedAtMs
            ) {
              skippedFiles += 1;
              errors.push({
                path: file.path,
                message: 'File changed after discovery and was skipped',
              });
              continue;
            }

            const candidateRealPath = await realpath(file.path);
            if (!isPathInside(scanned.rootRealPath, candidateRealPath)) {
              skippedFiles += 1;
              errors.push({
                path: file.path,
                message: 'File resolved outside its approved cleanup root',
              });
              continue;
            }

            await unlink(file.path);
            filesDeleted += 1;
            bytesFreed += file.size;
          } catch (error) {
            skippedFiles += 1;
            errors.push({
              path: file.path,
              message:
                error instanceof Error
                  ? error.message
                  : 'Unknown deletion error',
            });
          }
        }
      }

      const status = errors.length > 0 ? 'completed-with-errors' : 'completed';
      const completedAt = new Date();
      await this.prisma.maintenanceRun.update({
        where: { id: maintenanceRun.id },
        data: {
          status,
          completedAt,
          filesDeleted,
          bytesFreed: BigInt(bytesFreed),
          skippedFiles,
          errorCount: errors.length,
          errors: errors as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        maintenanceRunId: maintenanceRun.id,
        status,
        filesDeleted,
        bytesFreed,
        skippedFiles,
        errors,
        completedAt: completedAt.toISOString(),
      };
    } catch (error) {
      const failure = {
        path: '',
        message:
          error instanceof Error ? error.message : 'Unknown cleanup failure',
      };
      errors.push(failure);
      const completedAt = new Date();
      await this.prisma.maintenanceRun.update({
        where: { id: maintenanceRun.id },
        data: {
          status: 'failed',
          completedAt,
          filesDeleted,
          bytesFreed: BigInt(bytesFreed),
          skippedFiles,
          errorCount: errors.length,
          errors: errors as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        maintenanceRunId: maintenanceRun.id,
        status: 'failed',
        filesDeleted,
        bytesFreed,
        skippedFiles,
        errors,
        completedAt: completedAt.toISOString(),
      };
    }
  }

  private async scanRoot(root: CleanupRoot): Promise<ScannedRoot> {
    try {
      const rootRealPath = await realpath(root.path);
      const result = await walkFiles(rootRealPath);
      const totalBytes = result.files.reduce(
        (total, file) => total + file.size,
        0,
      );

      return {
        root,
        rootRealPath,
        files: result.files,
        summary: {
          label: root.label,
          path: root.path,
          fileCount: result.files.length,
          totalBytes,
          truncated: result.truncated,
          errors: result.errors,
        },
      };
    } catch (error) {
      const walkError = {
        path: root.path,
        message:
          error instanceof Error ? error.message : 'Unable to inspect root',
      };
      return {
        root,
        rootRealPath: root.path,
        files: [],
        summary: {
          label: root.label,
          path: root.path,
          fileCount: 0,
          totalBytes: 0,
          truncated: false,
          errors: [walkError],
        },
      };
    }
  }

  private summarize(
    scannedRoots: ScannedRoot[],
    requestedCategories: CleanupCategory[],
  ): CleanupScanResult {
    const categories = new Map<CleanupCategory, CategorySummary>();
    for (const category of requestedCategories) {
      categories.set(category, {
        category,
        fileCount: 0,
        totalBytes: 0,
        roots: [],
      });
    }

    for (const scanned of scannedRoots) {
      const existing = categories.get(scanned.root.category) ?? {
        category: scanned.root.category,
        fileCount: 0,
        totalBytes: 0,
        roots: [],
      };
      existing.fileCount += scanned.summary.fileCount;
      existing.totalBytes += scanned.summary.totalBytes;
      existing.roots.push(scanned.summary);
      categories.set(scanned.root.category, existing);
    }

    const grouped = [...categories.values()];
    return {
      fileCount: grouped.reduce(
        (total, category) => total + category.fileCount,
        0,
      ),
      totalBytes: grouped.reduce(
        (total, category) => total + category.totalBytes,
        0,
      ),
      categories: grouped,
      scannedAt: new Date().toISOString(),
    };
  }
}
