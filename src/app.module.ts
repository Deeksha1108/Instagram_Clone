import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { LoggerModule } from './common/logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { UserModule } from './modules/user/users.module';
import { PostService } from './modules/post/post.service';
import { PostController } from './modules/post/post.controller';
import { PostModule } from './modules/post/post.module';
import { FollowModule } from './modules/follow/follow.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestInterceptor } from './common/interceptors/request.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UserModule,
    PostModule,
    FollowModule,
    DatabaseModule,
    LoggerModule,
  ],
  controllers: [AppController, PostController],
  providers: [
    AppService,
    PostService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
