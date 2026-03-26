import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional } from "class-validator";

export class GetProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  userId?: string;
}