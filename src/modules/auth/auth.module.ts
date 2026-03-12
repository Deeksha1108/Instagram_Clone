import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TempTokenGuard } from 'src/common/guards/temp-token.guard';
import { RedisModule } from 'src/shared/redis/redis.module';
import { MailerModule } from 'src/shared/mailer/mailer.module';
import { User } from '../user/entities/user.entity';
import { AuthAttempt } from '../user/entities/auth_attempts.entity';

@Module({
  imports: [
    RedisModule,
    MailerModule,
    TypeOrmModule.forFeature([User, AuthAttempt]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: Number(config.getOrThrow<string>('JWT_EXPIRES_IN')) },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TempTokenGuard],
})
export class AuthModule {}
