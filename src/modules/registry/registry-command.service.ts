import { Injectable } from '@nestjs/common';
import { runCommand } from '../../common/process/run-command';
import { RegistryStartupKey } from './registry-key';

export interface RegistryValue {
  key: RegistryStartupKey;
  valueName: string;
  valueType: string;
  data: string;
}

@Injectable()
export class RegistryCommandService {
  async queryKey(key: RegistryStartupKey): Promise<RegistryValue[]> {
    const { stdout } = await runCommand('reg.exe', ['query', key]);
    return this.parseValues(key, stdout);
  }

  async queryValue(
    key: RegistryStartupKey,
    valueName: string,
  ): Promise<RegistryValue | null> {
    try {
      const { stdout } = await runCommand('reg.exe', [
        'query',
        key,
        '/v',
        valueName,
      ]);
      return (
        this.parseValues(key, stdout).find(
          (value) => value.valueName === valueName,
        ) ?? null
      );
    } catch (error) {
      if (
        error instanceof Error &&
        /unable to find|not find|does not exist/i.test(error.message)
      ) {
        return null;
      }
      throw error;
    }
  }

  async deleteValue(key: RegistryStartupKey, valueName: string): Promise<void> {
    await runCommand('reg.exe', ['delete', key, '/v', valueName, '/f']);
  }

  private parseValues(
    key: RegistryStartupKey,
    output: string,
  ): RegistryValue[] {
    const values: RegistryValue[] = [];
    for (const line of output.split(/\r?\n/)) {
      const match = line.match(/^\s+(.+?)\s+(REG_\w+)\s+(.*)$/);
      if (!match) {
        continue;
      }
      values.push({
        key,
        valueName: match[1].trim(),
        valueType: match[2].trim(),
        data: match[3].trim(),
      });
    }
    return values;
  }
}
