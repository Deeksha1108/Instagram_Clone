import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsEmail,
  IsPhoneNumber,
  IsString,
  Validate,
} from 'class-validator';
import { LoginIdentifierConstraint } from 'src/common/validators/login.validator';

export class LoginDto {
  @ApiProperty({ example: 'test@gmail.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '9876543210', required: false })
  @IsOptional()
  @IsPhoneNumber('IN')
  phone?: string;

  @ApiProperty({ example: 'disha08', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'Pass@123' })
  @IsString()
  password: string;

  @Validate(LoginIdentifierConstraint)
  _check?: any;
}
