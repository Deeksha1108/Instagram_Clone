import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  Validate,
} from 'class-validator';
import { EmailOrPhoneConstraint } from 'src/common/validators/email-or-phone.validator';
import { OtpType } from 'src/common/enum/otp-type.enum';

export class SendOtpDto {
  @ApiProperty({ example: 'test@gmail.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '9876543210', required: false })
  @IsOptional()
  @IsPhoneNumber('IN')
  phone?: string;

  @ApiProperty({
    enum: OtpType,
    enumName: 'OtpType',
    example: OtpType.SIGNUP,
    description: 'Purpose of OTP: SIGNUP or FORGOT_PASSWORD',
  })
  @IsEnum(OtpType)
  type: OtpType;

  @Validate(EmailOrPhoneConstraint)
  _check?: any;
}