import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ChatChannel } from '../../../common/enums';

export class MessagesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ChatChannel })
  @IsOptional()
  @IsEnum(ChatChannel)
  channel?: ChatChannel;
}
