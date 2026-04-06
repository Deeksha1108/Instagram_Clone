import { Type } from 'class-transformer';
import { ValidateNested, ArrayMinSize } from 'class-validator';
import { GenerateUploadUrlDto } from './generate-upload-url.dto';
import { ApiProperty } from '@nestjs/swagger';

export class BulkUploadDto {
  @ApiProperty({ type: [GenerateUploadUrlDto] })
  @ValidateNested({ each: true })
  @Type(() => GenerateUploadUrlDto)
  @ArrayMinSize(1)
  files: GenerateUploadUrlDto[];
}