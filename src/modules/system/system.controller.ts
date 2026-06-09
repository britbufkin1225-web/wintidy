import { Controller, Get } from '@nestjs/common';
import { SystemHealth, SystemService } from './system.service';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('health')
  getHealth(): Promise<SystemHealth> {
    return this.systemService.getHealth();
  }
}
