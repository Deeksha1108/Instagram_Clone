export const envConfiguration = () => ({
  nodeEnv: process.env.NODE_ENV,

  Jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: Number(process.env.JWT_EXPIRES_IN),
    refreshExpiresIn: Number(process.env.JWT_REFRESH_EXPIRES_IN),
    tempTokenExpiresIn: Number(process.env.TEMP_TOKEN_EXPIRES_IN),
  },

  Redis: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },

  Otp: {
    bypassEnabled: process.env.BYPASS_OTP_ENABLED === 'true',
    bypassCode: process.env.BYPASS_OTP,

    rateLimitMax: Number(process.env.OTP_RATE_LIMIT_MAX),
    rateLimitWindow: Number(process.env.OTP_RATE_LIMIT_WINDOW_SECONDS),
    maxVerifyAttempts: Number(process.env.OTP_MAX_VERIFY_ATTEMPTS),
  },

  Facebook: {
    graphUrl: process.env.FACEBOOK_GRAPH_URL,
    fields: process.env.FACEBOOK_FIELDS,
  },

  Google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
  },

  Apple: {
    jwksUri: process.env.APPLE_JWKS_URI,
    issuer: process.env.APPLE_ISSUER,
    clientId: process.env.APPLE_CLIENT_ID,
    algorithm: process.env.APPLE_JWT_ALGORITHM,
  },

  Smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
