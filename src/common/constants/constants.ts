export const AUTH_CONSTANTS = {
  OTP_REDIS_PREFIX: 'otp:',
  OTP_TTL_SECONDS: parseInt(process.env.OTP_TTL_SECONDS || '600', 10),
  TEMP_TOKEN_EXPIRES_IN: parseInt( process.env.TEMP_TOKEN_EXPIRES_IN || '1200', 10),
  UNKNOWN_DEVICE: 'unknown',
} as const;

export enum AUTH_PROVIDERS {
  LOCAL = 'local',
  FACEBOOK = 'facebook',
  GOOGLE = 'google',
  APPLE = 'apple',
}

export const REDIS_KEYS = {
  REFRESH_TOKEN: 'refresh_token',
};

export const USER_LIMITS = {
  BIO_MAX_LENGTH: 150,
};

export const USER_DEFAULTS = {
  SHOW_SUGGESTIONS: true,
};

export const PAGINATION = {
  LIMIT: 12,
};