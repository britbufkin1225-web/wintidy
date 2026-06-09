import { Module } from '@nestjs/common';
import { DuplicatesService } from './duplicates.service';
import { FilesController } from './files.controller';

@Module({
  controllers: [FilesController],
  providers: [DuplicatesService],
})
export class FilesModule {}
