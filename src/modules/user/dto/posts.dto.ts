import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PostType } from 'src/common/enum/enum.common';

export class GetPostsDto {
  @ApiProperty({ enum: PostType })
  @IsEnum(PostType)
  type: PostType;

  @ApiPropertyOptional()
  @IsOptional()
  cursor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  userId?: string;
}