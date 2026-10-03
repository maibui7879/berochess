import { Controller, Get, Param, ParseEnumPipe, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RatingType } from '../../common/enums';
import { RatingsService } from './ratings.service';

@ApiTags('ratings')
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Public()
  @Get('leaderboard')
  leaderboard(
    @Query('type', new ParseEnumPipe(RatingType, { optional: true }))
    type: RatingType = RatingType.COMPETITIVE,
    @Query('limit') limit = 20,
  ) {
    return this.ratingsService.leaderboard(type, Number(limit) || 20);
  }

  @Public()
  @Get('user/:userId')
  findAll(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.ratingsService.findAll(userId, query);
  }

  @Public()
  @Get('user/:userId/history')
  findHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.ratingsService.findHistory(userId, query);
  }

  @Public()
  @Get('user/:userId/:type')
  findOne(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('type', new ParseEnumPipe(RatingType)) type: RatingType,
  ) {
    return this.ratingsService.findOne(userId, type);
  }
}
