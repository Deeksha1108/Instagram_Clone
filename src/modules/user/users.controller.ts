import { Controller, Get, HttpCode, Param, Query, UseGuards } from '@nestjs/common';
import { GetUserProfileDto } from './dto/get-user-profile.dto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UserService } from './users.service';

@ApiTags('User Module')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':username')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile by username' })
  @HttpCode(200)
  getUserProfile(@Param() params: GetUserProfileDto) {
    return this.userService.getUserProfile(params.username);
  }
}