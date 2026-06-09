import { Controller, Get } from '@nestjs/common';
import { ProcessesService } from './processes.service';

@Controller('processes')
export class ProcessesController {
  constructor(private readonly processesService: ProcessesService) {}

  @Get()
  getProcesses() {
    return this.processesService.getProcesses();
  }
}
