import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JWT_CONFIG } from 'src/config/jwt.config';
import { AUTH_MESSAGES } from 'src/modules/auth/response/auth.response';
import { UserSession } from 'src/modules/user/entities/user_sessions.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService,
    @InjectRepository(UserSession)
    private readonly userSessionRepo: Repository<UserSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(AUTH_MESSAGES.AUTH_HEADER_MISSING);
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = this.jwtService.verify(token, {
        secret: JWT_CONFIG.secret,
      });
      const session = await this.userSessionRepo.findOne({
        where: {
          sessionId: payload.sessionId,
          isActive: true,
        },
        select: ['id'],
      });

      if (!session) {
        throw new UnauthorizedException(AUTH_MESSAGES.SESSION_EXPIRED);
      }
      request['user'] = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_TOKEN);
    }
  }
}