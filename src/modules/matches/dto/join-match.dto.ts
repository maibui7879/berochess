import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Side } from '../../../common/enums';

export class JoinMatchDto {
  @ApiPropertyOptional({ enum: Side, description: 'Màu muốn ngồi, bỏ trống = ghế còn trống đầu tiên' })
  @IsOptional()
  @IsEnum(Side)
  color?: Side;
}
