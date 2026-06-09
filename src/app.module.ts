import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma.module';
import { CleanupModule } from './modules/cleanup/cleanup.module';
import { FilesModule } from './modules/files/files.module';
import { ProcessesModule } from './modules/processes/processes.module';
import { StartupModule } from './modules/startup/startup.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [
    PrismaModule,
    SystemModule,
    CleanupModule,
    FilesModule,
    StartupModule,
    ProcessesModule,
  ],
})
export class AppModule {}
