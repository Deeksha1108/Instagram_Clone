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

@ApiTags('User Module')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get profile (self or other user)' })
  @HttpCode(200)
  getProfile(
    @CurrentUser('userId') loggedInUserId: string,
    @Query() dto: GetProfileDto,
  ) {
    return this.userService.getProfile(loggedInUserId, dto.userId);
  }

  @Get('posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get posts (self or other user)' })
  @HttpCode(200)
  getPosts(
    @CurrentUser('userId') loggedInUserId: string,
    @Query() dto: GetPostsDto,
  ) {
    return this.userService.getUserPosts(loggedInUserId, dto);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edit user profile' })
  editProfile(
    @CurrentUser('userId') userId: string,
    @Body() dto: EditProfileDto,
  ) {
    return this.userService.editProfile(userId, dto);
  }

  @Get('connections')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get followers / following list (paginated)' })
  @HttpCode(200)
  getConnections(
    @CurrentUser('userId') userId: string,
    @Query() dto: GetConnectionsDto,
  ) {
    return this.userService.getConnections(userId, dto);
  }
}