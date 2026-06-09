import { execFile } from 'node:child_process';

interface CommandResult {
  stdout: string;
  stderr: string;
}

export function runCommand(
  executable: string,
  args: string[],
  maxBuffer = 10 * 1024 * 1024,
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      executable,
      args,
      {
        encoding: 'utf8',
        maxBuffer,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              stderr.trim() || error.message || `Failed to run ${executable}`,
            ),
          );
          return;
        }

        resolve({ stdout, stderr });
      },
    );
  });
}
