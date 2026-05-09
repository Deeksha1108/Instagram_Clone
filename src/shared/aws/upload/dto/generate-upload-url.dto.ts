import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { FILE_TYPE, UploadTarget } from 'src/common/enum/enum.common';

export class GenerateUploadUrlDto {
  @ApiProperty({ example: 'image.png' })
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @ApiProperty({ example: 'image/png' })
  @IsString()
  @IsNotEmpty()
  fileType!: string;

  @ApiProperty({ enum: UploadTarget, example: UploadTarget.POST })
  @IsEnum(UploadTarget)
  target!: UploadTarget;

  @ApiProperty({ enum: FILE_TYPE, example: FILE_TYPE.IMAGE })
  @IsEnum(FILE_TYPE)
  fileCategory!: FILE_TYPE;
}