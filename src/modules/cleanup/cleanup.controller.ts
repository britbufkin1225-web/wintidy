import { Body, Controller, Get, Post } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { CleanupTargetsDto, RunCleanupDto } from './dto/cleanup-targets.dto';

@Controller('cleanup')
export class CleanupController {
  constructor(private readonly cleanupService: CleanupService) {}

  @Get('scan')
  scan() {
    return this.cleanupService.scan();
  }

  @Post('preview')
  preview(@Body() body: CleanupTargetsDto) {
    return this.cleanupService.preview(body.categories);
  }

  @Post('run')
  run(@Body() body: RunCleanupDto) {
    return this.cleanupService.run(body.categories);
  }
}
