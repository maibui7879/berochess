import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateCommentaryDto {
  @ApiProperty()
  @IsUUID()
  matchId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 5000)
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
