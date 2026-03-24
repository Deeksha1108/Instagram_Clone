import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserController } from './users.controller';
import { UserService } from './users.service';
import { AuthModule } from '../auth/auth.module';
import { PostModule } from '../post/post.module';
import { Follow } from '../follow/entities/follow.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Follow]), PostModule, AuthModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}