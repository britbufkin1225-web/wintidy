import { Module } from '@nestjs/common';
import { StartupController } from './startup.controller';
import { StartupService } from './startup.service';

@Module({
  controllers: [StartupController],
  providers: [StartupService],
})
export class StartupModule {}
