import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { COMMON_CONFIG } from 'src/config/common.config';
import { UPLOAD_MESSAGES } from '../upload/response/upload.response';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly bucket: string;
  constructor() {
    const { accessKeyId, secretAccessKey, region, bucket } = COMMON_CONFIG.AWS;

    if (!accessKeyId || !secretAccessKey || !region || !bucket) {
      throw new InternalServerErrorException(
        UPLOAD_MESSAGES.ENV_CONFIG_MISSING,
      );
    }
    this.bucket = bucket;

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
    try {
      const key = this.generateKey(params.folder, params.fileName);

      const command = new PutObjectCommand({
        Bucket: this.bucket,
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
    } catch {
      throw new InternalServerErrorException('Failed to generate upload URL');
    }
  }

  async moveObject(oldKey: string, newKey: string) {
    try {
      await this.s3.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${oldKey}`,
          Key: newKey,
        }),
      );

      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: oldKey,
        }),
      );

      return newKey;
    } catch {
      throw new InternalServerErrorException('Failed to move media');
    }
  }

  private generateKey(folder: string, fileName: string): string {
    const sanitized = fileName.replace(/\s+/g, '-').toLowerCase();
    return `${folder}/${uuidv4()}-${sanitized}`;
  }
}