import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import { OTP_CONFIG } from 'src/config/common.config';

export class VerifyOtpDto {
  @ApiProperty({ example: '1234' })
  @Length(OTP_CONFIG.LENGTH, OTP_CONFIG.LENGTH)
  @Matches(/^\d+$/, { message: 'OTP must be numeric' })
  @IsString()
  otp!: string;
}