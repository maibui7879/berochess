import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { GameService } from './game.service';

@ApiTags('game')
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get('states/:matchId')
  async findState(@Param('matchId', ParseUUIDPipe) matchId: string) {
    const state = await this.gameService.findState(matchId);
    if (!state) throw new NotFoundException('Game state not found');
    return state;
  }

  @Get('moves/:matchId')
  findMoves(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.gameService.findMoves(matchId, query);
  }
}
