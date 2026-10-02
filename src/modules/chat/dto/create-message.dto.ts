import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsUUID, Length } from 'class-validator';
import { ChatChannel } from '../../../common/enums';

export class CreateMessageDto {
  @ApiProperty()
  @IsUUID()
  matchId!: string;

  @ApiProperty({ enum: ChatChannel })
  @IsEnum(ChatChannel)
  channel!: ChatChannel;

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @Length(1, 1000)
  content!: string;
}
