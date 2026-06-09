import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';

export interface ExecutableAssessment {
  status: 'healthy' | 'orphaned' | 'ambiguous';
  executablePath: string | null;
  reason: string;
}

@Injectable()
export class RegistryExecutableService {
  assess(command: string): ExecutableAssessment {
    const executable = this.extractExecutable(command);
    if (!executable) {
      return {
        status: 'ambiguous',
        executablePath: null,
        reason:
          'Command does not contain a confidently resolvable executable path',
      };
    }

    const expanded = this.expandEnvironmentVariables(executable);
    if (!isAbsolute(expanded)) {
      return {
        status: 'ambiguous',
        executablePath: expanded,
        reason: 'Executable path is not absolute',
      };
    }

    const executablePath = normalize(expanded);
    if (existsSync(executablePath)) {
      return {
        status: 'healthy',
        executablePath,
        reason: 'Executable exists',
      };
    }

    return {
      status: 'orphaned',
      executablePath,
      reason: 'Executable path does not exist',
    };
  }

  private extractExecutable(command: string): string | null {
    const trimmed = command.trim();
    if (!trimmed || /^(shell:|https?:|ms-settings:)/i.test(trimmed)) {
      return null;
    }

    const quoted = trimmed.match(/^"([^"]+\.(?:exe|com|bat|cmd))"/i);
    if (quoted) {
      return quoted[1];
    }

    const unquoted = trimmed.match(
      /^((?:%[^%]+%|[A-Za-z]:)[^"]*?\.(?:exe|com|bat|cmd))(?=\s|$)/i,
    );
    return unquoted?.[1].trim() ?? null;
  }

  private expandEnvironmentVariables(path: string): string {
    return path.replace(/%([^%]+)%/g, (token, name: string) => {
      return process.env[name] ?? process.env[name.toUpperCase()] ?? token;
    });
  }
}
