import { IsEnum, IsString, IsUUID, Matches } from 'class-validator';
import { SpectatorTeam } from '../../../common/enums';

const SQUARE = /^[a-i][0-9]$/;

export class WsMatchJoinDto {
  @IsUUID()
  matchId!: string;
}

export class WsReadyDto {
  @IsUUID()
  matchId!: string;
}

export class WsMoveRequestDto {
  @IsUUID()
  matchId!: string;

  @IsString()
  @Matches(SQUARE)
  from!: string;

  @IsString()
  @Matches(SQUARE)
  to!: string;
}

export class WsSpectatorTeamDto {
  @IsUUID()
  matchId!: string;

  @IsEnum(SpectatorTeam)
  team!: SpectatorTeam;
}
