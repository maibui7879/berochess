import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CommentaryService } from './commentary.service';

@ApiTags('commentary')
@Controller('commentary')
export class CommentaryController {
  constructor(private readonly commentaryService: CommentaryService) {}

  @Get('item/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.commentaryService.findOne(id);
    if (!item) throw new NotFoundException('Commentary not found');
    return item;
  }

  @Get(':matchId')
  findByMatch(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentaryService.findByMatch(matchId, query);
  }
}
