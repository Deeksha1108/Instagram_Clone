import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { COMMON_CONFIG } from 'src/config/common.config';
import { UPLOAD_MESSAGES } from '../upload/response/upload.response';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;

  constructor() {
    const { accessKeyId, secretAccessKey, region } = COMMON_CONFIG.AWS;

    if (!accessKeyId || !secretAccessKey || !region) {
      throw new InternalServerErrorException( UPLOAD_MESSAGES.ENV_CONFIG_MISSING );
    }

    this.s3 = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async generateUploadUrl(params: {
    fileName: string;
    fileType: string;
    folder: string;
  }) {
    const key = this.generateKey(params.folder, params.fileName);

    const command = new PutObjectCommand({
      Bucket: COMMON_CONFIG.AWS.bucket,
      Key: key,
      ContentType: params.fileType,
    });

    const uploadUrl = await getSignedUrl(this.s3, command, {
      expiresIn: COMMON_CONFIG.AWS.signedUrlExpiry,
    });

    return {
      uploadUrl,
      key,
      fileUrl: `${COMMON_CONFIG.AWS.cloudfrontUrl}/${key}`,
    };
  }

  private generateKey(folder: string, fileName: string): string {
    const sanitized = fileName.replace(/\s+/g, '-').toLowerCase();
    return `${folder}/${Date.now()}-${sanitized}`;
  }
}