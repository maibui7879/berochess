import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { MatchesService } from './matches.service';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.matchesService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const match = await this.matchesService.findOne(id);
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  @Get(':id/players')
  findPlayers(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findPlayers(id);
  }

  @Get(':id/spectators')
  findSpectators(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findSpectators(id);
  }
}
