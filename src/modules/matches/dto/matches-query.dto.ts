import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { MatchMode, MatchStatus } from '../../../common/enums';

export class MatchesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: MatchStatus })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiPropertyOptional({ enum: MatchMode })
  @IsOptional()
  @IsEnum(MatchMode)
  mode?: MatchMode;
}
