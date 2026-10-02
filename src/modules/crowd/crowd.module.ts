import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrowdController } from './crowd.controller';
import { CrowdService } from './crowd.service';
import { CrowdReaction } from './entities/crowd-reaction.entity';
import { CrowdVote } from './entities/crowd-vote.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CrowdVote, CrowdReaction])],
  controllers: [CrowdController],
  providers: [CrowdService],
  exports: [CrowdService],
})
export class CrowdModule {}
