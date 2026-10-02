import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { MatchMode } from '../../../common/enums';

export class CreateMatchDto {
  @ApiPropertyOptional({ enum: MatchMode, default: MatchMode.CASUAL })
  @IsOptional()
  @IsEnum(MatchMode)
  mode?: MatchMode;

  @ApiPropertyOptional({ example: { noCaptureLimit: 60 } })
  @IsOptional()
  @IsObject()
  ruleSet?: Record<string, unknown>;
}
