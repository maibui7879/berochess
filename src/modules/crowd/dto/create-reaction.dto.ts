import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, Length } from 'class-validator';

export class CreateReactionDto {
  @ApiProperty()
  @IsUUID()
  matchId!: string;

  @ApiProperty({ example: '🔥' })
  @IsString()
  @Length(1, 20)
  emoji!: string;
}
