import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RegistryValue } from './registry-command.service';

@Injectable()
export class RegistryBackupService {
  async backup(
    runId: number,
    index: number,
    value: RegistryValue,
  ): Promise<string> {
    const directory = join(process.cwd(), 'data', 'registry-backups');
    await mkdir(directory, { recursive: true });
    const safeName = value.valueName.replace(/[^A-Za-z0-9._-]+/g, '_');
    const path = join(
      directory,
      `${runId}-${index + 1}-${safeName || 'unnamed'}.reg`,
    );
    const content = this.toRegistryFile(value);
    const utf16 = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(content, 'utf16le'),
    ]);
    await writeFile(path, utf16, { flag: 'wx' });
    return path;
  }

  private toRegistryFile(value: RegistryValue): string {
    if (/[\r\n]/.test(value.valueName)) {
      throw new Error('Registry value names containing line breaks are unsafe');
    }

    const name = this.escape(value.valueName);
    const header = 'Windows Registry Editor Version 5.00\r\n\r\n';
    const key = `[${this.canonicalKey(value.key)}]\r\n`;

    if (value.valueType === 'REG_SZ' || value.valueType === 'REG_EXPAND_SZ') {
      const bytes = Buffer.from(`${value.data}\0`, 'utf16le');
      const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
      const type = value.valueType === 'REG_SZ' ? '1' : '2';
      return `${header}${key}"${name}"=hex(${type}):${hex.join(',')}\r\n`;
    }

    throw new Error(`Unsupported registry value type: ${value.valueType}`);
  }

  private escape(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private canonicalKey(key: string): string {
    return key
      .replace(/^HKCU\\/i, 'HKEY_CURRENT_USER\\')
      .replace(/^HKLM\\/i, 'HKEY_LOCAL_MACHINE\\');
  }
}
