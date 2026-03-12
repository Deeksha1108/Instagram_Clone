import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {

  @ApiProperty({ example: 'pass123' })
  @IsString()
  @MinLength(6)
  @MaxLength(10)
  newPassword: string;
}