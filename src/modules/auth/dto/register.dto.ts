import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'kito123' })
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-zA-Z0-9_.]+$/, { message: 'username chỉ gồm chữ, số, _ và .' })
  username!: string;

  @ApiProperty({ example: 'kito@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'matkhau123', minLength: 8 })
  @IsString()
  @Length(8, 128)
  password!: string;

  @ApiPropertyOptional({ example: 'Kito' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;
}
