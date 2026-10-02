import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CrowdService } from './crowd.service';

@ApiTags('crowd')
@Controller('crowd')
export class CrowdController {
  constructor(private readonly crowdService: CrowdService) {}

  @Get('votes/:matchId')
  findVotes(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.crowdService.findVotes(matchId, query);
  }

  @Get('reactions/:matchId')
  findReactions(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.crowdService.findReactions(matchId, query);
  }
}
