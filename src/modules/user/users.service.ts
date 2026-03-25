import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { USER_MESSAGES } from './response/user.response';
import { Post } from '../post/entities/post.entity';
import { GetPostsDto } from './dto/posts.dto';
import { EditProfileDto } from './dto/editProfile.dto';
import { GetConnectionsDto } from './dto/getConnections.dto';
import { PAGINATION } from 'src/common/constants/constants';
import { buildPaginatedResponse } from 'src/common/utils/pagination.util';
import { ConnectionType, PostType } from 'src/common/enum/enum.common';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
  ) {}

  /**
   * Fetch profile (self + other user)
   * - if userId passed → fetch that user
   * - else → fetch logged-in user
   */
  async getProfile(loggedInUserId: string, userId?: string) {
    const targetUserId = userId || loggedInUserId;

    const user = await this.getBasicUser(targetUserId);

    return {
      message: USER_MESSAGES.PROFILE_FETCHED,
      data: user,
    };
  }

  /**
   * Fetch posts (self + other user)
   * - if userId passed → fetch that user's posts
   * - else → logged-in user posts
   */
  async getUserPosts(loggedInUserId: string, dto: GetPostsDto) {
    const { type, cursor, userId } = dto;
    const targetUserId = userId || loggedInUserId;
    const isSelf = targetUserId === loggedInUserId;

    switch (type) {
      case PostType.OWN:
        return this.getOwnPosts(targetUserId, cursor);

      case PostType.SAVED:
        if (!isSelf) {
          throw new ForbiddenException(USER_MESSAGES.SAVED_POSTS_FORBIDDEN);
        }
        return this.getSavedPosts(targetUserId, cursor);

      case PostType.TAGGED:
        return this.getTaggedPosts(targetUserId, cursor);

      default:
        throw new BadRequestException(USER_MESSAGES.INVALID_POST_TYPE);
    }
  }

  /**
   * Update profile fields (partial update)
   */
  async editProfile(userId: string, dto: EditProfileDto) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.USER_NOT_FOUND);
    }

    if (dto.bio !== undefined) user.bio = dto.bio;
    if (dto.gender !== undefined) user.gender = dto.gender;
    if (dto.showSuggestions !== undefined)
      user.showSuggestions = dto.showSuggestions;

    await this.userRepo.save(user);

    return {
      message: USER_MESSAGES.PROFILE_UPDATED,
      data: {
        bio: user.bio,
        gender: user.gender,
        showSuggestions: user.showSuggestions,
      },
    };
  }

  /**
   * Entry point for followers/following
   */
  async getConnections(userId: string, dto: GetConnectionsDto) {
    const { type, cursor } = dto;

    switch (type) {
      case ConnectionType.FOLLOWERS:
        return this.getFollowers(userId, cursor);

      case ConnectionType.FOLLOWING:
        return this.getFollowing(userId, cursor);

      default:
        throw new BadRequestException(USER_MESSAGES.INVALID_CONNECTION_TYPE);
    }
  }

  /**
   * Reusable helper for fetching minimal user data
   * Keeps query lightweight
   */
  private async getBasicUser(userId: string) {
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
    return user;
  }

  /**
   * Posts Helper Functions
   */
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
          .innerJoin('post.savedBy', 'sp')
          .andWhere('sp.userId = :userId', { userId }),
      cursor,
    );
  }

  private async getTaggedPosts(userId: string, cursor?: string) {
    return this.buildPostQuery(
      (qb) =>
        qb
          .innerJoin('post.taggedUsers', 'pt')
          .andWhere('pt.userId = :userId', { userId }),
      cursor,
    );
  }

  /**
   * Core reusable pagination query builder for posts
   * Implements cursor-based pagination (scalable)
   */
  private async buildPostQuery(
    filterFn: (qb: SelectQueryBuilder<Post>) => SelectQueryBuilder<Post>,
    cursor?: string,
  ) {
    const limit = PAGINATION.LIMIT;

    let qb = this.postRepo
      .createQueryBuilder('post')
      .orderBy('post.createdAt', 'DESC')
      .addOrderBy('post.id', 'DESC')
      .take(limit);

    if (cursor) {
      const [createdAt, id] = cursor.split('_');

      if (!createdAt || !id) {
        throw new BadRequestException(USER_MESSAGES.INVALID_CURSOR);
      }

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

    const result = buildPaginatedResponse(posts, limit);

    return {
      message: USER_MESSAGES.POSTS_FETCHED,
      data: {
        posts: result.items,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    };
  }

  /**
   * Connection Helpers
   * Followers = users who follow me
   */
  private async getFollowers(userId: string, cursor?: string) {
    return this.buildConnectionQuery(
      (qb) =>
        qb
          .innerJoin('user.followers', 'f')
          .innerJoin('f.follower', 'followerUser')
          .andWhere('f.followingId = :userId', { userId }),
      cursor,
    );
  }

  /**
   * Following = users I follow
   */
  private async getFollowing(userId: string, cursor?: string) {
    return this.buildConnectionQuery(
      (qb) =>
        qb
          .innerJoin('user.following', 'f')
          .innerJoin('f.following', 'followingUser')
          .andWhere('f.followerId = :userId', { userId }),
      cursor,
    );
  }

  /**
   * Reusable pagination logic for connections
   */
  private async buildConnectionQuery(
    filterFn: (qb: SelectQueryBuilder<User>) => SelectQueryBuilder<User>,
    cursor?: string,
  ) {
    const limit = PAGINATION.LIMIT;

    let qb = this.userRepo
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .addOrderBy('user.id', 'DESC')
      .take(limit);

    if (cursor) {
      const [createdAt, id] = cursor.split('_');

      if (!createdAt || !id) {
        throw new BadRequestException(USER_MESSAGES.INVALID_CURSOR);
      }
      qb = qb.andWhere(
        `(user.createdAt < :createdAt OR 
      (user.createdAt = :createdAt AND user.id < :id))`,
        {
          createdAt: new Date(createdAt),
          id,
        },
      );
    }

    qb = filterFn(qb);

    const users = await qb
      .select([
        'user.id',
        'user.username',
        'user.fullName',
        'user.profilePicture',
        'user.createdAt',
      ])
      .getMany();

    const result = buildPaginatedResponse(users, limit);

    return {
      message: USER_MESSAGES.CONNECTIONS_FETCHED,
      data: {
        users: result.items,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
    };
  }
}
