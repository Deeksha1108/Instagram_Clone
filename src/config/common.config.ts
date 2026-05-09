import { envConfiguration } from './env.configuration';

const env = envConfiguration();

export const COMMON_CONFIG = {
  nodeEnv: env.nodeEnv,
  jwt: env.Jwt,
  AWS: env.Aws,
  OTP: {
    bypassEnabled: env.Otp.bypassEnabled,
    bypassCode: env.Otp.bypassCode,

    rateLimitMax: env.Otp.rateLimitMax,
    rateLimitWindow: env.Otp.rateLimitWindow,
    maxVerifyAttempts: env.Otp.maxVerifyAttempts,
    expiryMinutes: env.Otp.expiryMinutes,
    onboardingSessionMinutes: env.Otp.onboardingSessionMinutes,
  },

  APP: env.App,
  MAIL: env.Mail,
  SMTP: env.Smtp,

  REDIS: env.Redis,
  FACEBOOK: env.Facebook,
  GOOGLE: env.Google,
  APPLE: env.Apple,
};

export const NODE_ENV_TYPE = {
  DEV: 'development',
  QA: 'qa',
  UAT: 'uat',
  PROD: 'production',
};

export const OTP_CONFIG = {
  LENGTH: 4,
};

export const BCRYPT_CONFIG = {
  OTP_SALT_ROUNDS: 6,
  PASSWORD_SALT_ROUNDS: 10,
};