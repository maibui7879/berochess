import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CreateMatchDto } from './dto/create-match.dto';
import { JoinMatchDto } from './dto/join-match.dto';
import { MatchesQueryDto } from './dto/matches-query.dto';
import { SpectatorTeamDto } from './dto/spectator-team.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchesService } from './matches.service';

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @ApiBearerAuth()
  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateMatchDto) {
    return this.matchesService.create(userId, dto);
  }

  @Public()
  @Get()
  findAll(@Query() query: MatchesQueryDto) {
    return this.matchesService.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findOne(id);
  }

  @ApiBearerAuth()
  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMatchDto,
  ) {
    return this.matchesService.update(userId, role, id, dto);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.matchesService.remove(id);
  }

  @ApiBearerAuth()
  @Post(':id/join')
  join(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JoinMatchDto,
  ) {
    return this.matchesService.join(userId, id, dto);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/leave')
  async leave(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.matchesService.leave(userId, id);
  }

  @ApiBearerAuth()
  @Post(':id/ready')
  ready(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.matchesService.setReady(userId, id);
  }

  @ApiBearerAuth()
  @Post(':id/resign')
  resign(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.matchesService.resign(userId, id);
  }

  @Public()
  @Get(':id/players')
  findPlayers(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findPlayers(id);
  }

  @Public()
  @Get(':id/spectators')
  findSpectators(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findSpectators(id);
  }

  @Public()
  @Get(':id/clock')
  async clock(@Param('id', ParseUUIDPipe) id: string) {
    const clock = await this.matchesService.getClockView(id);
    if (!clock) throw new NotFoundException('Clock not started');
    return clock;
  }

  @Public()
  @Get(':id/replay')
  replay(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.getReplay(id);
  }

  @ApiBearerAuth()
  @Post(':id/spectators')
  joinSpectators(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SpectatorTeamDto,
  ) {
    return this.matchesService.joinSpectators(userId, id, dto);
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/spectators')
  async leaveSpectators(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.matchesService.leaveSpectators(userId, id);
  }
}
