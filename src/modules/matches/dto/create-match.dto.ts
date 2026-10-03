import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MatchMode } from '../../../common/enums';
import { TimeControlDto } from './time-control.dto';

export class CreateMatchDto {
  @ApiPropertyOptional({ enum: MatchMode, default: MatchMode.CASUAL })
  @IsOptional()
  @IsEnum(MatchMode)
  mode?: MatchMode;

  @ApiPropertyOptional({ example: { noCaptureLimit: 60 } })
  @IsOptional()
  @IsObject()
  ruleSet?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Preset giờ. Mặc định 10 phút + 0s.' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeControlDto)
  clock?: TimeControlDto;
}
