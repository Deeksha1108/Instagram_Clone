import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { getDeviceInfo } from 'src/common/utils/device.util';

export const DeviceHeader = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const headerDevice = request.headers['device'] as string;
    if (headerDevice) return headerDevice;
    const userAgent = request.headers['user-agent'] as string;
    return getDeviceInfo(userAgent);
  },
);