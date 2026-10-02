import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ChatService } from './chat.service';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages/:matchId')
  findByMatch(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.chatService.findByMatch(matchId, query);
  }
}
