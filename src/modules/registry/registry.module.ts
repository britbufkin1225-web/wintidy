import { Module } from '@nestjs/common';
import { RegistryBackupService } from './registry-backup.service';
import { RegistryCommandService } from './registry-command.service';
import { RegistryController } from './registry.controller';
import { RegistryExecutableService } from './registry-executable.service';
import { RegistryService } from './registry.service';

@Module({
  controllers: [RegistryController],
  providers: [
    RegistryService,
    RegistryCommandService,
    RegistryExecutableService,
    RegistryBackupService,
  ],
})
export class RegistryModule {}
