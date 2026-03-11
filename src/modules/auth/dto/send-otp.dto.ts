import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsPhoneNumber, Validate } from 'class-validator';
import { EmailOrPhoneConstraint } from 'src/common/validators/email-or-phone.validator';

export class SendOtpDto {
  @ApiProperty({ example: 'test@gmail.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '9876543210', required: false })
  @IsOptional()
  @IsPhoneNumber('IN')
  phone?: string;

  @Validate(EmailOrPhoneConstraint)
  _check?: any;
}