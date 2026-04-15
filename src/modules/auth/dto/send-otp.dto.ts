import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  Validate,
  ValidateIf,
} from 'class-validator';
import { OtpType } from 'src/common/enum/enum.common';
import { IsE164PhoneConstraint } from 'src/common/validators/phone.validator';
import { AUTH_MESSAGES } from '../response/auth.response';
import { SendOtpValidator } from 'src/common/validators/send-otp.validator';

export class SendOtpDto {
  @ApiProperty({ example: 'test@gmail.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: AUTH_MESSAGES.INVALID_EMAIL })
  email?: string;

  @ApiProperty({ example: '+91', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{0,3}$/, { message: AUTH_MESSAGES.INVALID_COUNTRY_CODE })
  countryCode?: string;

  @ApiProperty({
    example: '9876543210',
    required: false,
    description:
      'Local phone digits — combined with countryCode into E.164 format server-side',
  })
  @IsOptional()
  @Transform(({ value, obj }) => {
    if (!value) return value;
    return obj.countryCode ? `${obj.countryCode}${value}` : value;
  })
  @ValidateIf((o) => !!o.phone && /^\+[1-9]\d{0,3}$/.test(o.countryCode))
  @Validate(IsE164PhoneConstraint)
  phone?: string;

  @ApiProperty({
    enum: OtpType,
    enumName: 'OtpType',
    example: OtpType.SIGNUP,
    description: 'Purpose of OTP: SIGNUP or FORGOT_PASSWORD',
  })
  @IsEnum(OtpType)
  type!: OtpType;

  @Validate(SendOtpValidator)
  _check?: any;
}