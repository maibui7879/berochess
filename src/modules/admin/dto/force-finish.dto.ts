import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { MatchEndReason, MatchWinner } from '../../../common/enums';

export class ForceFinishDto {
  @ApiProperty({ enum: MatchWinner })
  @IsEnum(MatchWinner)
  winner!: MatchWinner;

  @ApiProperty({ enum: MatchEndReason })
  @IsEnum(MatchEndReason)
  endReason!: MatchEndReason;
}
