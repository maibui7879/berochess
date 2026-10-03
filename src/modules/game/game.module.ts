import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WsAuthGuard } from '../../common/guards/ws-auth.guard';
import { MatchesModule } from '../matches/matches.module';
import { GameState } from './entities/game-state.entity';
import { Move } from './entities/move.entity';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';

@Module({
  imports: [TypeOrmModule.forFeature([GameState, Move]), forwardRef(() => MatchesModule)],
  controllers: [GameController],
  providers: [GameService, GameGateway, WsAuthGuard],
  exports: [GameService],
})
export class GameModule {}
