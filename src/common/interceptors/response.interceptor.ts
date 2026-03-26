import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { RESPONSE_MESSAGE } from '../decorators/response.decorator';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const message = this.reflector.get<string>(
      RESPONSE_MESSAGE,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data) => ({
        statusCode: response.statusCode,
        message,
        data,
      })),
    );
  }
}