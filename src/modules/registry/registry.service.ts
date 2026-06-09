import {
  ConflictException,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RegistryTargetDto } from './dto/registry-maintenance.dto';
import { RegistryBackupService } from './registry-backup.service';
import {
  RegistryCommandService,
  RegistryValue,
} from './registry-command.service';
import {
  ExecutableAssessment,
  RegistryExecutableService,
} from './registry-executable.service';
import { RegistryStartupKey } from './registry-key';

export interface RegistryFinding extends RegistryValue, ExecutableAssessment {}

export interface RegistryActionResult {
  key: RegistryStartupKey;
  valueName: string;
  status: 'removed' | 'skipped' | 'error';
  message: string;
  backupPath?: string;
}

export interface RegistryRunResult {
  registryMaintenanceRunId: number;
  status: 'completed' | 'completed-with-errors' | 'failed';
  entriesRemoved: number;
  skippedEntries: number;
  errors: number;
  results: RegistryActionResult[];
  completedAt: string;
}

@Injectable()
export class RegistryService {
  private runInProgress = false;

  constructor(
    private readonly commands: RegistryCommandService,
    private readonly executables: RegistryExecutableService,
    private readonly backups: RegistryBackupService,
    private readonly prisma: PrismaService,
  ) {}

  async scan(): Promise<{
    findings: RegistryFinding[];
    orphanedCount: number;
    ambiguousCount: number;
    errors: string[];
    scannedAt: string;
  }> {
    this.assertWindows();
    const findings: RegistryFinding[] = [];
    const errors: string[] = [];

    for (const key of Object.values(RegistryStartupKey)) {
      try {
        const values = await this.commands.queryKey(key);
        findings.push(...values.map((value) => this.assess(value)));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        if (!/unable to find|not find|does not exist/i.test(message)) {
          errors.push(`${key}: ${message}`);
        }
      }
    }

    return {
      findings,
      orphanedCount: findings.filter((item) => item.status === 'orphaned')
        .length,
      ambiguousCount: findings.filter((item) => item.status === 'ambiguous')
        .length,
      errors,
      scannedAt: new Date().toISOString(),
    };
  }

  async preview(targets: RegistryTargetDto[]): Promise<{
    targets: RegistryFinding[];
    removableCount: number;
    skippedCount: number;
    previewedAt: string;
  }> {
    this.assertWindows();
    const assessed = await Promise.all(
      targets.map((target) => this.queryAndAssess(target)),
    );
    const existing = assessed.filter(
      (finding): finding is RegistryFinding => finding !== null,
    );

    return {
      targets: existing,
      removableCount: existing.filter((item) => item.status === 'orphaned')
        .length,
      skippedCount:
        targets.length -
        existing.filter((item) => item.status === 'orphaned').length,
      previewedAt: new Date().toISOString(),
    };
  }

  async run(targets: RegistryTargetDto[]): Promise<RegistryRunResult> {
    this.assertWindows();
    if (this.runInProgress) {
      throw new ConflictException(
        'A registry maintenance run is already in progress',
      );
    }

    this.runInProgress = true;
    try {
      return await this.performRun(targets);
    } finally {
      this.runInProgress = false;
    }
  }

  private async performRun(
    targets: RegistryTargetDto[],
  ): Promise<RegistryRunResult> {
    const run = await this.prisma.registryMaintenanceRun.create({
      data: {
        status: 'running',
        requestedTargets: targets as unknown as Prisma.InputJsonValue,
        confirmationReceived: true,
      },
    });
    const results: RegistryActionResult[] = [];
    const backupPaths: string[] = [];

    for (const [index, target] of targets.entries()) {
      try {
        const finding = await this.queryAndAssess(target);
        if (!finding || finding.status !== 'orphaned') {
          results.push({
            key: target.key,
            valueName: target.valueName,
            status: 'skipped',
            message: finding
              ? finding.reason
              : 'Registry value no longer exists',
          });
          continue;
        }

        const backupPath = await this.backups.backup(run.id, index, finding);
        backupPaths.push(backupPath);

        const revalidated = await this.commands.queryValue(
          target.key,
          target.valueName,
        );
        if (
          !revalidated ||
          revalidated.valueType !== finding.valueType ||
          revalidated.data !== finding.data ||
          this.assess(revalidated).status !== 'orphaned'
        ) {
          results.push({
            key: target.key,
            valueName: target.valueName,
            status: 'skipped',
            message: 'Registry value changed after backup and was skipped',
            backupPath,
          });
          continue;
        }

        await this.commands.deleteValue(target.key, target.valueName);
        results.push({
          key: target.key,
          valueName: target.valueName,
          status: 'removed',
          message: 'Orphaned startup value removed after backup',
          backupPath,
        });
      } catch (error) {
        results.push({
          key: target.key,
          valueName: target.valueName,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const entriesRemoved = results.filter(
      (result) => result.status === 'removed',
    ).length;
    const skippedEntries = results.filter(
      (result) => result.status === 'skipped',
    ).length;
    const errorCount = results.filter(
      (result) => result.status === 'error',
    ).length;
    const status: RegistryRunResult['status'] =
      errorCount > 0 ? 'completed-with-errors' : 'completed';
    const completedAt = new Date();

    await this.prisma.registryMaintenanceRun.update({
      where: { id: run.id },
      data: {
        status,
        completedAt,
        entriesRemoved,
        skippedEntries,
        errorCount,
        backupPaths,
        results: results as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      registryMaintenanceRunId: run.id,
      status,
      entriesRemoved,
      skippedEntries,
      errors: errorCount,
      results,
      completedAt: completedAt.toISOString(),
    };
  }

  private async queryAndAssess(
    target: RegistryTargetDto,
  ): Promise<RegistryFinding | null> {
    const value = await this.commands.queryValue(target.key, target.valueName);
    return value ? this.assess(value) : null;
  }

  private assess(value: RegistryValue): RegistryFinding {
    return {
      ...value,
      ...this.executables.assess(value.data),
    };
  }

  private assertWindows(): void {
    if (process.platform !== 'win32') {
      throw new NotImplementedException(
        'Registry maintenance is supported only on Windows',
      );
    }
  }
}
