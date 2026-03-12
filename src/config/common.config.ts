import { envConfiguration } from './env.configuration';

const env = envConfiguration();

export const COMMON_CONFIG = {
  nodeEnv: env.nodeEnv,

  otp: {
    bypassEnabled: env.otp.bypassEnabled,
    bypassCode: env.otp.bypassCode,

    rateLimitMax: env.otp.rateLimitMax,
    rateLimitWindow: env.otp.rateLimitWindow,
    maxVerifyAttempts: env.otp.maxVerifyAttempts,
  },

  redis: {
    host: env.redis.host,
    port: env.redis.port,
  },
};

export const NODE_ENV_TYPE = {
  DEV: 'development',
  QA: 'qa',
  UAT: 'uat',
  PROD: 'production',
};