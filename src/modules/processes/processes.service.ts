import { Injectable, NotImplementedException } from '@nestjs/common';
import { runCommand } from '../../common/process/run-command';

interface PowerShellProcess {
  id: number;
  name: string;
  memoryBytes: number;
  cpuSeconds: number | null;
  startedAt: string | null;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  memoryBytes: number;
  cpuSeconds: number | null;
  startedAt: string | null;
}

@Injectable()
export class ProcessesService {
  async getProcesses(): Promise<{
    processes: ProcessInfo[];
    count: number;
    observedAt: string;
  }> {
    if (process.platform !== 'win32') {
      throw new NotImplementedException(
        'Process inspection is supported only on Windows',
      );
    }

    const script = [
      '$ErrorActionPreference = "SilentlyContinue"',
      'Get-Process | ForEach-Object {',
      '  [PSCustomObject]@{',
      '    id = $_.Id',
      '    name = $_.ProcessName',
      '    memoryBytes = $_.WorkingSet64',
      '    cpuSeconds = $_.CPU',
      '    startedAt = if ($_.StartTime) { $_.StartTime.ToUniversalTime().ToString("o") } else { $null }',
      '  }',
      '} | Sort-Object memoryBytes -Descending | ConvertTo-Json -Compress',
    ].join('\n');
    const { stdout } = await runCommand('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ]);
    const trimmed = stdout.trim();
    const parsed = trimmed
      ? (JSON.parse(trimmed) as PowerShellProcess | PowerShellProcess[])
      : [];
    const rawProcesses = Array.isArray(parsed) ? parsed : [parsed];
    const processes = rawProcesses
      .map((entry) => ({
        pid: Number(entry.id),
        name: String(entry.name),
        memoryBytes: Number(entry.memoryBytes ?? 0),
        cpuSeconds:
          entry.cpuSeconds === null || entry.cpuSeconds === undefined
            ? null
            : Number(entry.cpuSeconds),
        startedAt: entry.startedAt ? String(entry.startedAt) : null,
      }))
      .sort((left, right) => right.memoryBytes - left.memoryBytes);

    return {
      processes,
      count: processes.length,
      observedAt: new Date().toISOString(),
    };
  }
}
