import { Controller, Post, Body, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { ResponseMessage } from 'src/common/decorators/response.decorator';
import { UPLOAD_MESSAGES } from './response/upload.response';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Shared')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('shared')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Generate presigned upload URL' })
  @HttpCode(200)
  @ResponseMessage(UPLOAD_MESSAGES.URL_GENERATED)
  generateUploadUrl(@Body() dto: GenerateUploadUrlDto) {
    return this.uploadService.generateUploadUrl(dto);
  }

  @Post('presigned-url/bulk')
  @ApiOperation({ summary: 'Generate bulk presigned upload URLs' })
  @HttpCode(200)
  @ResponseMessage(UPLOAD_MESSAGES.BULK_URL_GENERATED)
  bulkUpload(@Body() dto: BulkUploadDto) {
    return this.uploadService.generateBulkUploadUrls(dto.files);
  }
}
