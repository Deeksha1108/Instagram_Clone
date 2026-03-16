import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { ApiResponse } from '../auth/interfaces/auth-response.interface';
import { USER_MESSAGES } from './response/user.response';
import { UserProfileResponse } from './interfaces/user-response.interface';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getUserProfile(
    username: string,
  ): Promise<ApiResponse<UserProfileResponse>> {
    const user = await this.userRepo.findOne({
      where: { username },
      select: ['id', 'username', 'fullName'],
    });

    if (!user) {
      throw new NotFoundException(USER_MESSAGES.USER_NOT_FOUND);
    }

    /**
     * Future modules
     * posts -> posts module
     * followers -> follow module
     * following -> follow module
     */

    const stats = {
      posts: 0,
      followers: 0,
      following: 0,
    };

    return {
      message: USER_MESSAGES.USER_PROFILE_FETCHED,
      data: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        stats,
      },
    };
  }
}
