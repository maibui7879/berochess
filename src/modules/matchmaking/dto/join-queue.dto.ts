import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MatchMode } from '../../../common/enums';
import { TimeControlDto } from '../../matches/dto/time-control.dto';

export class JoinQueueDto {
  @ApiProperty({ enum: [MatchMode.RANKED, MatchMode.CASUAL] })
  @IsEnum(MatchMode)
  mode!: MatchMode;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => TimeControlDto)
  clock?: TimeControlDto;
}
