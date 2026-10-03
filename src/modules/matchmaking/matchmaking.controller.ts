import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JoinQueueDto } from './dto/join-queue.dto';
import { MatchmakingService } from './matchmaking.service';

@ApiTags('matchmaking')
@ApiBearerAuth()
@Controller('matchmaking')
export class MatchmakingController {
  constructor(private readonly matchmaking: MatchmakingService) {}

  @HttpCode(HttpStatus.OK)
  @Post('join')
  join(@CurrentUser('userId') userId: string, @Body() dto: JoinQueueDto) {
    return this.matchmaking.join(userId, dto);
  }

  @Get('status')
  status(@CurrentUser('userId') userId: string) {
    return this.matchmaking.status(userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('leave')
  leave(@CurrentUser('userId') userId: string) {
    return this.matchmaking.leave(userId);
  }
}
