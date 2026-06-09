import { lstat, opendir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export interface WalkedFile {
  path: string;
  size: number;
  modifiedAtMs: number;
}

export interface WalkError {
  path: string;
  message: string;
}

export interface WalkResult {
  files: WalkedFile[];
  errors: WalkError[];
  truncated: boolean;
}

export interface WalkOptions {
  maxFiles?: number;
  maxDepth?: number;
}

interface PendingDirectory {
  path: string;
  depth: number;
}

const DEFAULT_MAX_FILES = 100_000;
const DEFAULT_MAX_DEPTH = 64;

export async function walkFiles(
  root: string,
  options: WalkOptions = {},
): Promise<WalkResult> {
  const absoluteRoot = resolve(root);
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const files: WalkedFile[] = [];
  const errors: WalkError[] = [];
  const pending: PendingDirectory[] = [{ path: absoluteRoot, depth: 0 }];
  let truncated = false;

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) {
      break;
    }

    if (current.depth > maxDepth) {
      errors.push({
        path: current.path,
        message: `Maximum traversal depth of ${maxDepth} exceeded`,
      });
      truncated = true;
      continue;
    }

    try {
      const directory = await opendir(current.path);
      for await (const entry of directory) {
        const entryPath = resolve(current.path, entry.name);
        if (!isPathInside(absoluteRoot, entryPath)) {
          errors.push({
            path: entryPath,
            message: 'Entry resolved outside the scan root',
          });
          continue;
        }

        try {
          const stats = await lstat(entryPath);
          if (stats.isSymbolicLink()) {
            continue;
          }

          if (stats.isDirectory()) {
            pending.push({ path: entryPath, depth: current.depth + 1 });
            continue;
          }

          if (!stats.isFile()) {
            continue;
          }

          files.push({
            path: entryPath,
            size: stats.size,
            modifiedAtMs: stats.mtimeMs,
          });

          if (files.length >= maxFiles) {
            truncated = true;
            break;
          }
        } catch (error) {
          errors.push(toWalkError(entryPath, error));
        }
      }
    } catch (error) {
      errors.push(toWalkError(current.path, error));
    }

    if (truncated && files.length >= maxFiles) {
      break;
    }
  }

  return { files, errors, truncated };
}

export function isPathInside(root: string, candidate: string): boolean {
  if (!isAbsolute(root) || !isAbsolute(candidate)) {
    return false;
  }

  const pathFromRoot = relative(resolve(root), resolve(candidate));
  return (
    pathFromRoot !== '' &&
    pathFromRoot !== '..' &&
    !pathFromRoot.startsWith(`..\\`) &&
    !pathFromRoot.startsWith('../') &&
    !isAbsolute(pathFromRoot)
  );
}

function toWalkError(path: string, error: unknown): WalkError {
  return {
    path,
    message:
      error instanceof Error ? error.message : 'Unknown filesystem error',
  };
}
