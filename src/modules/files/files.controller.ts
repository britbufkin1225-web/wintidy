import { Controller, Get, Query } from '@nestjs/common';
import { DuplicateQueryDto } from './dto/duplicate-query.dto';
import { DuplicatesService } from './duplicates.service';

@Controller('files')
export class FilesController {
  constructor(private readonly duplicatesService: DuplicatesService) {}

  @Get('duplicates')
  findDuplicates(@Query() query: DuplicateQueryDto) {
    return this.duplicatesService.findDuplicates(query.path);
  }
}
