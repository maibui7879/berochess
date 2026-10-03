import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/enums';
import { MatchesService } from '../matches/matches.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UsersQueryDto } from '../users/dto/users-query.dto';
import { UsersService } from '../users/users.service';
import { AdminService } from './admin.service';
import { ForceFinishDto } from './dto/force-finish.dto';

/**
 * Khu vực quản trị — toàn bộ yêu cầu role ADMIN.
 * Đặc quyền: xem thống kê, quản lý user/role, kết thúc match cưỡng bức.
 */
@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly usersService: UsersService,
    private readonly matchesService: MatchesService,
  ) {}

  @Get('stats')
  stats() {
    return this.adminService.stats();
  }

  @Get('users')
  users(@Query() query: UsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Patch('users/:id')
  updateUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Post('matches/:id/finish')
  finishMatch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ForceFinishDto) {
    return this.matchesService.finish(id, dto.winner, dto.endReason);
  }
}
