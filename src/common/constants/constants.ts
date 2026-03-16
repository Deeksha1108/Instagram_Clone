export const AUTH_CONSTANTS = {
  OTP_REDIS_PREFIX: 'otp:',
  OTP_TTL_SECONDS: parseInt(process.env.OTP_TTL_SECONDS || '600', 10),
  TEMP_TOKEN_EXPIRES_IN: parseInt( process.env.TEMP_TOKEN_EXPIRES_IN || '1200', 10),
  UNKNOWN_DEVICE: 'unknown',
} as const;

export const AUTH_PROVIDERS = {
  LOCAL: 'local',
  FACEBOOK: 'facebook',
} as const;

export type AUTH_PROVIDERS =
  (typeof AUTH_PROVIDERS)[keyof typeof AUTH_PROVIDERS];

export const REDIS_KEYS = {
  REFRESH_TOKEN: 'refresh_token',
};