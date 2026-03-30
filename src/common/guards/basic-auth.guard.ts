import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { COMMON_CONFIG } from 'src/config/common.config';

@Injectable()
export class BasicAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Basic ')) {
      throw new UnauthorizedException('Missing Basic Auth header');
    }

    const base64Credentials = authHeader.split(' ')[1];
    const [username, password] = Buffer.from(base64Credentials, 'base64')
      .toString()
      .split(':');

    if (
      username !== COMMON_CONFIG.APP?.SEND_OTP_BASIC_USER ||
      password !== COMMON_CONFIG.APP?.SEND_OTP_BASIC_PASS
    ) {
      throw new UnauthorizedException('Invalid Basic Auth credentials');
    }

    return true;
  }
}