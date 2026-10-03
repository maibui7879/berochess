import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ChatChannel, UserRole } from '../../common/enums';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Public()
  @Get('messages/:matchId')
  findByMatch(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query() query: PaginationQueryDto,
    @Query('channel', new ParseEnumPipe(ChatChannel, { optional: true }))
    channel?: ChatChannel,
  ) {
    return this.chatService.findByMatch(matchId, query, channel);
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
