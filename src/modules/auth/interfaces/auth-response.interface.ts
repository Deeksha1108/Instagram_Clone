export interface SendOtpResponse {
  tempToken: string;
  maskedContact: string;
}

export interface VerifyOtpResponse {
  verified: boolean;
}

export interface CreateProfileResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
  needsUsername?: boolean;
}
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenPayload {
  userId: string;
  username: string;
  sessionId: string;
}

export interface AppleJwtPayload {
  sub: string;
  email?: string;
  email_verified?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}