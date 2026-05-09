import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreatePostDto } from './dto/create-posts.dto';
import { User } from '../user/entities/user.entity';
import { Post } from './entities/post.entity';
import { PostMedia } from './entities/post-media.entity';
import { POST_MESSAGES } from './response/post.response';
import { S3Service } from 'src/shared/aws/s3/s3.service';
import { v4 as uuidv4 } from 'uuid';
import { S3_PATHS } from 'src/common/constants/constants';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * Creates post with media:
   * - validates user
   * - validated media ownership
   * - moves files draft -> final
   * - stored only S3 keys
   */
  async createPost(userId: string, dto: CreatePostDto) {
    return this.dataSource.transaction(async (manager) => {
      const userExists = await manager.exists(User, {
        where: { id: userId },
      });

      if (!userExists) {
        this.logger.warn(`Invalid user while creating post: ${userId}`);
        throw new BadRequestException(POST_MESSAGES.INVALID_USER);
      }

      this.validateMediaOrder(dto);

      this.validateMediaOwnership(userId, dto);

      const post = await manager.save(
        manager.create(Post, {
          userId,
          caption: dto.caption,
          mediaCount: dto.media.length,
        }),
      );

      const mediaEntities = await Promise.all(
        dto.media.map(async (m) => {
          const extension = this.extractExtension(m.key);

          const newKey = this.buildFinalKey(userId, post.id, extension);

          let finalKey: string;
          try {
            finalKey = await this.s3Service.moveObject(m.key, newKey);
          } catch (err) {
            this.logger.error(`S3 move failed for key: ${m.key}`, err);
            throw new InternalServerErrorException('Media processing failed');
          }
          return manager.create(PostMedia, {
            postId: post.id,
            key: finalKey,
            type: m.type,
            order: m.order,
          });
        }),
      );

      await manager.save(mediaEntities);

      await manager.increment(User, { id: userId }, 'postsCount', 1);

      this.logger.log(`Post created: ${post.id} by user: ${userId}`);

      return { postId: post.id };
    });
  }

  // ================= HELPERS =================

  private validateMediaOrder(dto: CreatePostDto) {
    const orders = dto.media.map((m) => m.order);

    if (orders.length !== new Set(orders).size) {
      throw new BadRequestException(POST_MESSAGES.DUPLICATE_MEDIA_ORDER);
    }
  }

  private validateMediaOwnership(userId: string, dto: CreatePostDto) {
    const prefix = `${S3_PATHS.POSTS}/${userId}/${S3_PATHS.DRAFT}/`;
    dto.media.forEach((m) => {
      if (!m.key.startsWith(prefix)) {
        throw new BadRequestException(POST_MESSAGES.INVALID_MEDIA_OWNERSHIP);
      }
    });
  }

  private extractExtension(key: string): string {
    return key.split('.').pop() || 'jpg';
  }

  private buildFinalKey(
    userId: string,
    postId: string,
    extension: string,
  ): string {
    return `${S3_PATHS.POSTS}/${userId}/${postId}/${uuidv4()}.${extension}`;
  }
}
