import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UserRole } from '../../common/enums';
import { CreateActionDto } from './dto/create-action.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsQueryDto } from './dto/reports-query.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ModerationService } from './moderation.service';

@ApiTags('moderation')
@ApiBearerAuth()
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('reports')
  createReport(@CurrentUser('userId') userId: string, @Body() dto: CreateReportDto) {
    return this.moderationService.createReport(userId, dto);
  }

  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @Get('reports')
  findReports(@Query() query: ReportsQueryDto) {
    return this.moderationService.findReports(query, query.status);
  }

  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @Patch('reports/:id')
  updateReportStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReportDto) {
    return this.moderationService.updateReportStatus(id, dto.status);
  }

  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @Post('actions')
  createAction(@CurrentUser('userId') userId: string, @Body() dto: CreateActionDto) {
    return this.moderationService.createAction(userId, dto);
  }

  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @Get('actions')
  findActions(@Query() query: PaginationQueryDto) {
    return this.moderationService.findActions(query);
  }
}
