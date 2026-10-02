import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ModerationActionType } from '../../../common/enums';

export class CreateActionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  matchId?: string;

  @ApiProperty({ enum: ModerationActionType })
  @IsEnum(ModerationActionType)
  action!: ModerationActionType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
