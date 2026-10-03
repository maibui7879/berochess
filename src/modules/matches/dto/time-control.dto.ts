import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class TimeControlDto {
  @ApiPropertyOptional({ example: 600000, description: 'Giờ ban đầu mỗi bên (ms)' })
  @IsInt()
  @Min(500)
  @Max(3_600_000)
  initialMs!: number;

  @ApiPropertyOptional({ example: 0, description: 'Cộng thêm mỗi nước (ms, Fischer)' })
  @IsInt()
  @Min(0)
  @Max(60_000)
  incrementMs!: number;
}
