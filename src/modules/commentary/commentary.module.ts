import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentaryController } from './commentary.controller';
import { CommentaryService } from './commentary.service';
import { Commentary } from './entities/commentary.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Commentary])],
  controllers: [CommentaryController],
  providers: [CommentaryService],
  exports: [CommentaryService],
})
export class CommentaryModule {}
