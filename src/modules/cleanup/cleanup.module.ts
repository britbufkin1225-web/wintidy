import { Module } from '@nestjs/common';
import { CleanupController } from './cleanup.controller';
import { CleanupRootsService } from './cleanup-roots.service';
import { CleanupService } from './cleanup.service';

@Module({
  controllers: [CleanupController],
  providers: [CleanupRootsService, CleanupService],
})
export class CleanupModule {}
