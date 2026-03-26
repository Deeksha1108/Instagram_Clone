export const envConfiguration = () => ({
  nodeEnv: process.env.NODE_ENV || '',

  otp: {
    bypassEnabled: process.env.BYPASS_OTP_ENABLED === 'true',
    bypassCode: process.env.BYPASS_OTP || '',

    rateLimitMax: parseInt(process.env.OTP_RATE_LIMIT_MAX ?? '5', 10),
    rateLimitWindow: parseInt(
      process.env.OTP_RATE_LIMIT_WINDOW_SECONDS || '',
      10,
    ),

    maxVerifyAttempts: parseInt(process.env.OTP_MAX_VERIFY_ATTEMPTS || '', 10),
  },

  redis: {
    host: process.env.REDIS_HOST || '',
    port: parseInt(process.env.REDIS_PORT || '', 10),
  },
});
