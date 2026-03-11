export const AUTH_CONSTANTS = {
  OTP_REDIS_PREFIX: 'otp:',
  OTP_TTL_SECONDS: parseInt(process.env.OTP_TTL_SECONDS || '600', 10),
  TEMP_TOKEN_EXPIRES_IN: parseInt(process.env.TEMP_TOKEN_EXPIRES_IN || '1200', 10),
} as const;
