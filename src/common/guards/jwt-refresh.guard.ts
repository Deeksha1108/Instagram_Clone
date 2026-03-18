import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JWT_CONFIG } from 'src/config/jwt.config';
import { RefreshTokenPayload } from 'src/modules/auth/interfaces/auth-response.interface';
import { RedisService } from 'src/shared/redis/redis.service';

interface RequestWithUser extends Request {
  user: RefreshTokenPayload;
}

@Injectable()
export class JwtRefreshGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const token = authHeader.split(' ')[1];
    let payload: RefreshTokenPayload;

    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(token, {
        secret: JWT_CONFIG.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const key = `refresh_token:${payload.sessionId}`;
    const storedToken = await this.redisService.get(key);

    if (!storedToken || storedToken !== token) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }
    request.user = payload;
    return true;
  }
}