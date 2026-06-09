import { Injectable } from '@nestjs/common';
import { existsSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, normalize, resolve } from 'node:path';
import { CleanupCategory } from './cleanup-category';

export interface CleanupRoot {
  category: CleanupCategory;
  label: string;
  path: string;
}

@Injectable()
export class CleanupRootsService {
  getAvailableRoots(): CleanupRoot[] {
    const candidates: CleanupRoot[] = [
      {
        category: CleanupCategory.UserTemp,
        label: 'User temporary files',
        path: tmpdir(),
      },
      {
        category: CleanupCategory.WindowsTemp,
        label: 'Windows temporary files',
        path: join(process.env.WINDIR ?? 'C:\\Windows', 'Temp'),
      },
      ...this.browserCacheRoots(),
    ];
    const seen = new Set<string>();

    return candidates.filter((root) => {
      const normalizedPath = normalize(resolve(root.path)).toLowerCase();
      if (seen.has(normalizedPath) || !existsSync(root.path)) {
        return false;
      }

      seen.add(normalizedPath);
      return true;
    });
  }

  getRootsFor(categories: CleanupCategory[]): CleanupRoot[] {
    const selected = new Set(categories);
    return this.getAvailableRoots().filter((root) =>
      selected.has(root.category),
    );
  }

  private browserCacheRoots(): CleanupRoot[] {
    const localAppData =
      process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
    return [
      ...this.chromiumCacheRoots(
        join(localAppData, 'Google', 'Chrome', 'User Data'),
        'Google Chrome',
      ),
      ...this.chromiumCacheRoots(
        join(localAppData, 'Microsoft', 'Edge', 'User Data'),
        'Microsoft Edge',
      ),
      ...this.firefoxCacheRoots(
        join(localAppData, 'Mozilla', 'Firefox', 'Profiles'),
      ),
    ];
  }

  private chromiumCacheRoots(
    userDataPath: string,
    browser: string,
  ): CleanupRoot[] {
    return this.childDirectories(userDataPath)
      .filter(
        (profile) =>
          profile === 'Default' ||
          profile === 'Guest Profile' ||
          profile.startsWith('Profile '),
      )
      .flatMap((profile) =>
        ['Cache', 'Code Cache', 'GPUCache'].map((cacheDirectory) => ({
          category: CleanupCategory.BrowserCache,
          label: `${browser} ${profile} ${cacheDirectory}`,
          path: join(userDataPath, profile, cacheDirectory),
        })),
      );
  }

  private firefoxCacheRoots(profilesPath: string): CleanupRoot[] {
    return this.childDirectories(profilesPath).map((profile) => ({
      category: CleanupCategory.BrowserCache,
      label: `Mozilla Firefox ${profile} cache`,
      path: join(profilesPath, profile, 'cache2'),
    }));
  }

  private childDirectories(path: string): string[] {
    try {
      return readdirSync(path, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }
}
