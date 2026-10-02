import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ModerationService } from './moderation.service';

@ApiTags('moderation')
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('reports')
  findReports(@Query() query: PaginationQueryDto) {
    return this.moderationService.findReports(query);
  }

  @Get('actions')
  findActions(@Query() query: PaginationQueryDto) {
    return this.moderationService.findActions(query);
  }
}
