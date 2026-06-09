import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  RegistryPreviewDto,
  RegistryRunDto,
} from './dto/registry-maintenance.dto';
import { RegistryService } from './registry.service';

@Controller('registry')
export class RegistryController {
  constructor(private readonly registryService: RegistryService) {}

  @Get('scan')
  scan() {
    return this.registryService.scan();
  }

  @Post('preview')
  preview(@Body() body: RegistryPreviewDto) {
    return this.registryService.preview(body.targets);
  }

  @Post('run')
  run(@Body() body: RegistryRunDto) {
    return this.registryService.run(body.targets);
  }
}
