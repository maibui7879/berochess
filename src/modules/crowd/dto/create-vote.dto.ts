import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, IsUUID, Matches, Min } from 'class-validator';

export class CreateVoteDto {
  @ApiProperty()
  @IsUUID()
  matchId!: string;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  moveNumber!: number;

  @ApiProperty({ example: 'b0' })
  @IsString()
  @Matches(/^[a-i][0-9]$/)
  from!: string;

  @ApiProperty({ example: 'c2' })
  @IsString()
  @Matches(/^[a-i][0-9]$/)
  to!: string;
}
