import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { LessThan, Repository } from 'typeorm';
import { USER_MESSAGES } from './response/user.response';
import { Post } from '../post/entities/post.entity';
import { GetMyPostsDto } from './dto/myPosts.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
  ) {}

  /**
   * Get top profile data (VERY LIGHT QUERY)
   */
  async getMyProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: [
        'id',
        'username',
        'fullName',
        'bio',
        'profilePicture',
        'postsCount',
        'followersCount',
        'followingCount',
        'isPrivate',
      ],
    });

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.USER_NOT_FOUND);
    }

    return {
      message: USER_MESSAGES.PROFILE_FETCHED,
      data: user,
    };
  }

  /**
   * Get posts with cursor pagination (SCALABLE)
   */
  async getMyPosts(userId: string, dto: GetMyPostsDto) {
    const { type, cursor } = dto;

    switch (type) {
      case 'OWN':
        return this.getOwnPosts(userId, cursor);

      case 'SAVED':
        return this.getSavedPosts(userId, cursor);

      case 'TAGGED':
        return this.getTaggedPosts(userId, cursor);

      default:
        throw new BadRequestException(USER_MESSAGES.INVALID_POST_TYPE);
    }
  }

  private async getOwnPosts(userId: string, cursor?: string) {
    return this.buildPostQuery(
      (qb) => qb.andWhere('post.userId = :userId', { userId }),
      cursor,
    );
  }

  private async getSavedPosts(userId: string, cursor?: string) {
    return this.buildPostQuery(
      (qb) =>
        qb
          .innerJoin('saved_posts', 'sp', 'sp.post_id = post.id')
          .andWhere('sp.user_id = :userId', { userId }),
      cursor,
    );
  }

  private async getTaggedPosts(userId: string, cursor?: string) {
    return this.buildPostQuery(
      (qb) =>
        qb
          .innerJoin('post_tags', 'pt', 'pt.post_id = post.id')
          .andWhere('pt.user_id = :userId', { userId }),
      cursor,
    );
  }

  private async buildPostQuery(filterFn: (qb: any) => any, cursor?: string) {
    const limit = 12;

    let qb = this.postRepo
      .createQueryBuilder('post')
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(limit);

    if (cursor) {
      const [createdAt, id] = cursor.split('_');

      qb = qb.andWhere(
        `(post.createdAt < :createdAt OR 
        (post.createdAt = :createdAt AND post.id < :id))`,
        {
          createdAt: new Date(createdAt),
          id,
        },
      );
    }

    qb = filterFn(qb);

    const posts = await qb
      .select(['post.id', 'post.imageUrl', 'post.createdAt'])
      .getMany();

    const lastPost = posts[posts.length - 1];

    return {
      message: USER_MESSAGES.POSTS_FETCHED,
      data: {
        posts,
        nextCursor: lastPost
          ? `${lastPost.createdAt.toISOString()}_${lastPost.id}`
          : null,
        hasMore: posts.length === limit,
      },
    };
  }
}
