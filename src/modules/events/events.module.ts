import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameEvent } from './entities/game-event.entity';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([GameEvent])],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
