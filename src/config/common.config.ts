import { envConfiguration } from './env.configuration';

const env = envConfiguration();

export const COMMON_CONFIG = {
  nodeEnv: env.nodeEnv,
  jwt: env.Jwt,
  OTP: {
    bypassEnabled: env.Otp.bypassEnabled,
    bypassCode: env.Otp.bypassCode,

    rateLimitMax: env.Otp.rateLimitMax,
    rateLimitWindow: env.Otp.rateLimitWindow,
    maxVerifyAttempts: env.Otp.maxVerifyAttempts,
  },

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
  LENGTH: 6,
};