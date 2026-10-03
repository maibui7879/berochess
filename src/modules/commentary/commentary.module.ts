import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { CommentaryController } from './commentary.controller';
import { CommentaryService } from './commentary.service';
import { AiCommentaryService } from './ai/ai-commentary.service';
import { COMMENTARY_GENERATOR } from './ai/commentary-generator.interface';
import { TemplateCommentaryGenerator } from './ai/template-commentary.generator';
import { Commentary } from './entities/commentary.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Commentary, User])],
  controllers: [CommentaryController],
  providers: [
    CommentaryService,
    AiCommentaryService,
    { provide: COMMENTARY_GENERATOR, useClass: TemplateCommentaryGenerator },
  ],
  exports: [CommentaryService, AiCommentaryService],
})
export class CommentaryModule {}
