import { Request } from 'express';

export interface TempTokenData {
  email?: string;
  phoneNumber?: string;
  type: string;
}

export interface RequestWithTempToken extends Request {
  tempTokenData: TempTokenData;
}
