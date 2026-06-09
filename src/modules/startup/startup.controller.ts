import { Controller, Get } from '@nestjs/common';
import { StartupService } from './startup.service';

@Controller('startup')
export class StartupController {
  constructor(private readonly startupService: StartupService) {}

  @Get('apps')
  getStartupApps() {
    return this.startupService.getStartupApps();
  }
}
