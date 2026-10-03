import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CrowdService } from './crowd.service';
import { CreateReactionDto } from './dto/create-reaction.dto';

@ApiTags('crowd')
@Controller('crowd')
export class CrowdController {
  constructor(private readonly crowdService: CrowdService) {}

  @ApiBearerAuth()
  @Post('reactions')
  react(@CurrentUser('userId') userId: string, @Body() dto: CreateReactionDto) {
    return this.crowdService.createReaction(userId, dto);
  }

  @Public()
  @Get('reactions/:matchId')
  findReactions(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.crowdService.findReactions(matchId, query);
  }
}
