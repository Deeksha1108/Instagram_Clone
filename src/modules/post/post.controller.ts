import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CreatePostDto } from './dto/create-posts.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResponseMessage } from 'src/common/decorators/response.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { PostService } from './post.service';
import { POST_MESSAGES } from './response/post.response';

@ApiTags('Post Module')
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new post' })
  @HttpCode(201)
  @ResponseMessage(POST_MESSAGES.POST_CREATED)
  createPost(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postService.createPost(userId, dto);
  }
}
