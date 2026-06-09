import { Injectable, NotImplementedException } from '@nestjs/common';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { runCommand } from '../../common/process/run-command';
import { PrismaService } from '../../database/prisma.service';

export interface StartupApp {
  name: string;
  command: string;
  source: 'startup-folder' | 'registry';
  scope: 'user' | 'machine';
  location: string;
  enabled: boolean | null;
}

interface RegistryLocation {
  key: string;
  scope: StartupApp['scope'];
}

@Injectable()
export class StartupService {
  constructor(private readonly prisma: PrismaService) {}

  async getStartupApps(): Promise<{
    apps: StartupApp[];
    count: number;
    observedAt: string;
    errors: string[];
  }> {
    if (process.platform !== 'win32') {
      throw new NotImplementedException(
        'Startup application inspection is supported only on Windows',
      );
    }

    const errors: string[] = [];
    const apps = [
      ...(await this.readStartupFolders(errors)),
      ...(await this.readRegistryEntries(errors)),
    ].sort((left, right) => left.name.localeCompare(right.name));

    for (const app of apps) {
      try {
        await this.prisma.startupEntry.upsert({
          where: {
            source_location_name: {
              source: `${app.source}:${app.scope}`,
              location: app.location,
              name: app.name,
            },
          },
          create: {
            name: app.name,
            command: app.command,
            source: `${app.source}:${app.scope}`,
            location: app.location,
            enabled: app.enabled,
          },
          update: {
            command: app.command,
            enabled: app.enabled,
          },
        });
      } catch (error) {
        errors.push(
          `Unable to record startup entry ${app.name}: ${
            error instanceof Error ? error.message : 'unknown database error'
          }`,
        );
      }
    }

    return {
      apps,
      count: apps.length,
      observedAt: new Date().toISOString(),
      errors,
    };
  }

  private async readStartupFolders(errors: string[]): Promise<StartupApp[]> {
    const appData =
      process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming');
    const programData = process.env.PROGRAMDATA ?? 'C:\\ProgramData';
    const folders = [
      {
        path: join(
          appData,
          'Microsoft',
          'Windows',
          'Start Menu',
          'Programs',
          'Startup',
        ),
        scope: 'user' as const,
      },
      {
        path: join(
          programData,
          'Microsoft',
          'Windows',
          'Start Menu',
          'Programs',
          'Startup',
        ),
        scope: 'machine' as const,
      },
    ];
    const apps: StartupApp[] = [];

    for (const folder of folders) {
      try {
        const entries = await readdir(folder.path, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile() || entry.isSymbolicLink()) {
            continue;
          }
          const path = join(folder.path, entry.name);
          apps.push({
            name: basename(entry.name, extname(entry.name)),
            command: path,
            source: 'startup-folder',
            scope: folder.scope,
            location: path,
            enabled: null,
          });
        }
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'ENOENT') {
          errors.push(
            `Unable to read ${folder.path}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
        }
      }
    }

    return apps;
  }

  private async readRegistryEntries(errors: string[]): Promise<StartupApp[]> {
    const locations: RegistryLocation[] = [
      {
        key: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
        scope: 'user',
      },
      {
        key: 'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
        scope: 'machine',
      },
      {
        key: 'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run',
        scope: 'machine',
      },
    ];
    const apps: StartupApp[] = [];

    for (const location of locations) {
      try {
        const { stdout } = await runCommand('reg.exe', ['query', location.key]);
        for (const line of stdout.split(/\r?\n/)) {
          const match = line.match(/^\s+(.+?)\s+REG_\w+\s+(.*)$/);
          if (!match) {
            continue;
          }
          apps.push({
            name: match[1].trim(),
            command: match[2].trim(),
            source: 'registry',
            scope: location.scope,
            location: location.key,
            enabled: null,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'unknown error';
        if (!/unable to find|not find|does not exist/i.test(message)) {
          errors.push(`Unable to query ${location.key}: ${message}`);
        }
      }
    }

    return apps;
  }
}
