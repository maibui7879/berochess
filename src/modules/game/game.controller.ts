import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { GameService } from './game.service';
import { START_FEN, createGame } from 'xiangqi-engine';

@ApiTags('game')
@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  /** Bàn cờ khai cuộc chuẩn cho client render (hằng số, không phải state của match). */
  @Public()
  @Get('initial-position')
  initialPosition() {
    const game = createGame();
    return { fen: START_FEN, turn: game.turn, moveNumber: game.moveNumber };
  }

  @Public()
  @Get('states/:matchId')
  async findState(@Param('matchId', ParseUUIDPipe) matchId: string) {
    const state = await this.gameService.findState(matchId);
    if (!state) throw new NotFoundException('Game state not found');
    return state;
  }

  @Public()
  @Get('moves/:matchId')
  findMoves(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.gameService.findMoves(matchId, query);
  }

  @Public()
  @Get('legal-moves/:matchId')
  legalMoves(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query('from') from: string,
  ) {
    return this.gameService.getLegalMovesFor(matchId, from);
  }
}
