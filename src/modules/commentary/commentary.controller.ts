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
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UserRole } from '../../common/enums';
import { CommentaryService } from './commentary.service';
import { CreateCommentaryDto } from './dto/create-commentary.dto';

@ApiTags('commentary')
@Controller('commentary')
export class CommentaryController {
  constructor(private readonly commentaryService: CommentaryService) {}

  @ApiBearerAuth()
  @Roles(UserRole.COMMENTATOR, UserRole.MODERATOR, UserRole.ADMIN)
  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateCommentaryDto) {
    return this.commentaryService.create(userId, dto);
  }

  @Public()
  @Get(':matchId')
  findByMatch(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.commentaryService.findByMatch(matchId, query);
  }

  @Public()
  @Get('item/:id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const item = await this.commentaryService.findOne(id);
    if (!item) throw new NotFoundException('Commentary not found');
    return item;
  }

  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('item/:id')
  async remove(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.commentaryService.remove(id, userId, role);
  }
}
