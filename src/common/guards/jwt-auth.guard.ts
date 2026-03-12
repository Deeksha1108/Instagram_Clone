import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JWT_CONFIG } from 'src/config/jwt.config';
import { MESSAGES } from 'src/modules/auth/response/auth.response';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(MESSAGES.AUTH_HEADER_MISSING);
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = this.jwtService.verify(token, { secret: JWT_CONFIG.secret });
      request['user'] = payload;
      return true;
    } catch (err) {
      throw new UnauthorizedException(MESSAGES.INVALID_TOKEN);
    }
  }
}