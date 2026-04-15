import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { SavedPost } from './entities/saved-post.entity';
import { PostTag } from './entities/post-tag.entity';
import { S3Module } from 'src/shared/aws/s3/s3.module';
import { PostMedia } from './entities/post-media.entity';
import { AuthModule } from '../auth/auth.module';
import { UserSession } from '../user/entities/user_sessions.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      PostMedia,
      SavedPost,
      PostTag,
      UserSession,
    ]),
    S3Module,
    AuthModule,
  ],
  controllers: [PostController],
  providers: [PostService],
  exports: [TypeOrmModule],
})
export class PostModule {}
