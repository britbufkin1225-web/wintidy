import { Injectable } from '@nestjs/common';
import { statfs } from 'node:fs/promises';
import { cpus, freemem, hostname, platform, totalmem, uptime } from 'node:os';

interface Usage {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
}

export interface SystemHealth {
  hostname: string;
  platform: string;
  uptimeSeconds: number;
  cpu: {
    logicalCores: number;
    loadPercent: number;
  };
  memory: Usage;
  disk: Usage & {
    path: string;
  };
  observedAt: string;
}

interface CpuSnapshot {
  idle: number;
  total: number;
}

@Injectable()
export class SystemService {
  async getHealth(): Promise<SystemHealth> {
    const [cpuLoadPercent, disk] = await Promise.all([
      this.measureCpuLoad(),
      this.getDiskUsage(),
    ]);
    const memoryTotal = totalmem();
    const memoryFree = freemem();

    return {
      hostname: hostname(),
      platform: platform(),
      uptimeSeconds: Math.floor(uptime()),
      cpu: {
        logicalCores: cpus().length,
        loadPercent: cpuLoadPercent,
      },
      memory: this.toUsage(memoryTotal, memoryFree),
      disk,
      observedAt: new Date().toISOString(),
    };
  }

  private async measureCpuLoad(): Promise<number> {
    const start = this.cpuSnapshot();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const end = this.cpuSnapshot();
    const totalDelta = end.total - start.total;
    const idleDelta = end.idle - start.idle;

    if (totalDelta <= 0) {
      return 0;
    }

    return this.roundPercent(((totalDelta - idleDelta) / totalDelta) * 100);
  }

  private cpuSnapshot(): CpuSnapshot {
    return cpus().reduce<CpuSnapshot>(
      (snapshot, cpu) => {
        const times = cpu.times;
        const total =
          times.user + times.nice + times.sys + times.idle + times.irq;
        return {
          idle: snapshot.idle + times.idle,
          total: snapshot.total + total,
        };
      },
      { idle: 0, total: 0 },
    );
  }

  private async getDiskUsage(): Promise<SystemHealth['disk']> {
    const diskPath = process.cwd();
    const stats = await statfs(diskPath);
    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;

    return {
      path: diskPath,
      ...this.toUsage(totalBytes, freeBytes),
    };
  }

  private toUsage(totalBytes: number, freeBytes: number): Usage {
    const usedBytes = Math.max(0, totalBytes - freeBytes);
    return {
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercent:
        totalBytes === 0
          ? 0
          : this.roundPercent((usedBytes / totalBytes) * 100),
    };
  }

  private roundPercent(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
