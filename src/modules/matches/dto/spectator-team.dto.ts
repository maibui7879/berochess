import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { SpectatorTeam } from '../../../common/enums';

export class SpectatorTeamDto {
  @ApiProperty({ enum: SpectatorTeam })
  @IsEnum(SpectatorTeam)
  team!: SpectatorTeam;
}
