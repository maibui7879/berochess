import { IsString, IsUUID, Matches } from 'class-validator';

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
