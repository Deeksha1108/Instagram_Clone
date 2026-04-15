import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEmail, IsString, Validate } from 'class-validator';
import { LoginIdentifierConstraint } from 'src/common/validators/login.validator';

export class LoginDto {
  @ApiProperty({ example: 'user12@gmail.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'user12', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'Pass@123' })
  @IsString()
  password!: string;

  @Validate(LoginIdentifierConstraint)
  _check?: any;
}
