import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { S3Module } from '../s3/s3.module';
import { AuthModule } from 'src/modules/auth/auth.module';
import { UserSession } from 'src/modules/user/entities/user_sessions.entity';

@Module({
  imports: [S3Module, AuthModule, TypeOrmModule.forFeature([UserSession])],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}