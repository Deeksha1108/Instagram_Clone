import { Injectable, BadRequestException } from '@nestjs/common';
import { GenerateUploadUrlDto } from './dto/generate-upload-url.dto';
import {
  BulkPresignedUrlResponse,
  PresignedUrlResponse,
} from './interfaces/upload.interfaces';
import { UPLOAD_MESSAGES } from './response/upload.response';
import { S3_PATHS, UPLOAD_FILE_TYPE_MAP } from 'src/common/constants/constants';
import { S3Service } from '../s3/s3.service';
import { FILE_TYPE, UploadTarget } from 'src/common/enum/enum.common';

@Injectable()
export class UploadService {
  constructor(private readonly s3Service: S3Service) {}

  async generateUploadUrl(
    userId: string,
    dto: GenerateUploadUrlDto,
  ): Promise<PresignedUrlResponse> {
    this.validateFileType(dto.fileType, dto.fileCategory);

    const folder = this.getUploadFolder(userId, dto.target);

    return this.s3Service.generateUploadUrl({
      fileName: dto.fileName,
      fileType: dto.fileType,
      folder,
    });
  }

  async generateBulkUploadUrls(
    userId: string,
    files: GenerateUploadUrlDto[],
  ): Promise<BulkPresignedUrlResponse> {
    const result = await Promise.all(
      files.map((file) => this.generateUploadUrl(userId, file)),
    );

    return { files: result };
  }

  private validateFileType(fileType: string, fileCategory: FILE_TYPE) {
    const allowedMimeTypes = UPLOAD_FILE_TYPE_MAP[fileCategory]?.mimeTypes;

    if (!allowedMimeTypes || !allowedMimeTypes.includes(fileType)) {
      throw new BadRequestException(UPLOAD_MESSAGES.INVALID_FILE_TYPE);
    }
  }

  private getUploadFolder(userId: string, target: UploadTarget): string {
    switch (target) {
      case UploadTarget.POST:
        return `${S3_PATHS.POSTS}/${userId}/${S3_PATHS.DRAFT}`;

      case UploadTarget.PROFILE:
        return `${S3_PATHS.PROFILE}/${userId}`;

      default:
        throw new BadRequestException(UPLOAD_MESSAGES.INVALID_UPLOAD_TARGET);
    }
  }
}