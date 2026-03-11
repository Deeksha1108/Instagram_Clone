import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TempTokenData } from 'src/common/types/auth.types';

@Injectable()
export class TempTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader: string = request.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!token) throw new UnauthorizedException('Temp token is required');

    try {
      const decoded = await this.jwtService.verifyAsync<TempTokenData & { type: string }>(token);

      if (!decoded.email && !decoded.phoneNumber) {
        throw new BadRequestException('Invalid temp token: missing identifier');
      }

      request.tempTokenData = {
        email: decoded.email,
        phoneNumber: decoded.phoneNumber,
        type: decoded.type,
      } satisfies TempTokenData;

      return true;
    } catch (error: unknown) {
      if ((error as { name?: string }).name === 'TokenExpiredError') {
        throw new UnauthorizedException('Temp token has expired');
      }
      if ((error as { name?: string }).name === 'JsonWebTokenError') {
        throw new BadRequestException('Invalid temp token');
      }
      throw error;
    }
  }
}