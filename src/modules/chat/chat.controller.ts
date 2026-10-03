import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole } from '../../common/enums';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessagesQueryDto } from './dto/messages-query.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Public()
  @Get('messages/:matchId')
  findByMatch(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query() query: MessagesQueryDto,
  ) {
    return this.chatService.findByMatch(matchId, query, query.channel);
  }

  @ApiBearerAuth()
  @Post('messages')
  create(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() dto: CreateMessageDto,
  ) {
    return this.chatService.sendMessage(userId, role, dto);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('messages/:id')
  async remove(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.chatService.softDelete(id, userId, role);
  }
}
