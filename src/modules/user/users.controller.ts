import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UserService } from './users.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { EditProfileDto } from './dto/editProfile.dto';
import { GetConnectionsDto } from './dto/getConnections.dto';
import { GetPostsDto } from './dto/posts.dto';
import { GetProfileDto } from './dto/userProfile.dto';
import { ResponseMessage } from 'src/common/decorators/response.decorator';
import { USER_MESSAGES } from './response/user.response';

@ApiTags('User Module')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get profile (self or other user)' })
  @HttpCode(200)
  @ResponseMessage(USER_MESSAGES.PROFILE_FETCHED)
  getProfile(
    @CurrentUser('userId') loggedInUserId: string,
    @Query() dto: GetProfileDto,
  ) {
    return this.userService.getProfile(loggedInUserId, dto.userId);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Get posts (self or other user)' })
  @HttpCode(200)
  @ResponseMessage(USER_MESSAGES.POSTS_FETCHED)
  getPosts(
    @CurrentUser('userId') loggedInUserId: string,
    @Query() dto: GetPostsDto,
  ) {
    return this.userService.getUserPosts(loggedInUserId, dto);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Edit user profile' })
  @HttpCode(200)
  @ResponseMessage(USER_MESSAGES.PROFILE_UPDATED)
  editProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: EditProfileDto,
  ) {
    return this.userService.editProfile(userId, dto);
  }

  @Get('connections')
  @ApiOperation({ summary: 'Get followers / following list (paginated)' })
  @HttpCode(200)
  @ResponseMessage(USER_MESSAGES.CONNECTIONS_FETCHED)
  getConnections(
    @CurrentUser('userId') userId: string,
    @Query() dto: GetConnectionsDto,
  ) {
    return this.userService.getConnections(userId, dto);
  }
}