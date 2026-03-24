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
import { GetMyPostsDto } from './dto/myPosts.dto';
import { EditProfileDto } from './dto/editProfile.dto';
import { GetConnectionsDto } from './dto/getConnections.dto';

@ApiTags('User Module')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get logged-in user profile (top section)' })
  @HttpCode(200)
  getMyProfile(@CurrentUser('userId') userId: string) {
    return this.userService.getMyProfile(userId);
  }

  @Get('me/posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get logged-in user posts (paginated)' })
  @HttpCode(200)
  getMyPosts(
    @CurrentUser('userId') userId: string,
    @Query() dto: GetMyPostsDto,
  ) {
    return this.userService.getMyPosts(userId, dto);
  }

  @Patch('me')
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