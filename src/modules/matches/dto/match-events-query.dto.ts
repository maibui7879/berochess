import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { GameEventType } from '../../../common/enums';

export class MatchEventsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: GameEventType })
  @IsOptional()
  @IsEnum(GameEventType)
  type?: GameEventType;
}
