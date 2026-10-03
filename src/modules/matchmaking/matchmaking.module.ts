import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module';
import { RatingsModule } from '../ratings/ratings.module';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingService } from './matchmaking.service';

@Module({
  imports: [MatchesModule, RatingsModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
