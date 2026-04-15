import { IsEnum, IsInt, IsNotEmpty, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FILE_TYPE } from '../../../common/enum/enum.common';

export class PostMediaDto {
  @ApiProperty({ example: 'posts/userId/draft/abc123.jpg' })
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ enum: FILE_TYPE, example: FILE_TYPE.IMAGE })
  @IsEnum(FILE_TYPE)
  type!: FILE_TYPE;

  @ApiProperty({ example: 0, minimum: 0, maximum: 9 })
  @IsInt()
  @Min(0)
  @Max(9)
  order!: number;
}
