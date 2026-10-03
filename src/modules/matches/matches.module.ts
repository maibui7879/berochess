import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameModule } from '../game/game.module';
import { MatchClock } from './entities/match-clock.entity';
import { MatchPlayer } from './entities/match-player.entity';
import { MatchSpectator } from './entities/match-spectator.entity';
import { Match } from './entities/match.entity';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

@Module({
  imports: [TypeOrmModule.forFeature([Match, MatchPlayer, MatchSpectator, MatchClock]), forwardRef(() => GameModule)],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
