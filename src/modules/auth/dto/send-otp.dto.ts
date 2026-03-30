import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, Validate } from 'class-validator';
import { OtpType } from 'src/common/enum/enum.common';
import { SendOtpValidator } from 'src/common/validators/email-or-phone.validator';

export class SendOtpDto {
  @ApiProperty({ example: 'test@gmail.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+91', required: false })
  @IsOptional()
  countryCode?: string;

  @ApiProperty({ example: '9876543210', required: false })
  @IsOptional()
  phone?: string;

  @ApiProperty({
    enum: OtpType,
    enumName: 'OtpType',
    example: OtpType.SIGNUP,
    description: 'Purpose of OTP: SIGNUP or FORGOT_PASSWORD',
  })
  @IsEnum(OtpType)
  type: OtpType;

  @Validate(SendOtpValidator)
  _check?: any;
}