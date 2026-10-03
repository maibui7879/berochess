import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameEvent } from '../events/entities/game-event.entity';
import { Move } from '../game/entities/move.entity';
import { MatchesModule } from '../matches/matches.module';
import { Match } from '../matches/entities/match.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Match, Move, GameEvent]),
    UsersModule,
    MatchesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
