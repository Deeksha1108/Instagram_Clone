import { FILE_TYPE, UploadTarget } from '../enum/enum.common';
export const AUTH_CONSTANTS = {
  OTP_REDIS_PREFIX: 'otp:',
  OTP_TTL_SECONDS: Number(process.env.OTP_EXPIRY_MINUTES) * 60,
  // Controlled via ONBOARDING_SESSION_MINUTES env var (default 30 min).
  // Must be >= time a user needs to complete: create-password → create-username → create-profile.
  ONBOARDING_SESSION_TTL_SECONDS:
    Number(process.env.ONBOARDING_SESSION_MINUTES || '30') * 60,
  // Controlled via TEMP_TOKEN_EXPIRES_IN env var (default 40 min).
  // Must be >= OTP_EXPIRY_MINUTES + ONBOARDING_SESSION_MINUTES + small buffer.
  TEMP_TOKEN_EXPIRES_IN: parseInt( process.env.TEMP_TOKEN_EXPIRES_IN || '2400', 10),
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

export const UPLOAD_FILE_TYPE_MAP: Record<FILE_TYPE, { mimeTypes: string[] }> =
  {
    [FILE_TYPE.IMAGE]: {
      mimeTypes: ['image/jpeg', 'image/png'],
    },
    [FILE_TYPE.VIDEO]: {
      mimeTypes: ['video/mp4'],
    },
  };

export const UPLOAD_TARGET_FOLDER_MAP: Record<
  UploadTarget,
  Partial<Record<FILE_TYPE, string>>
> = {
  [UploadTarget.POST]: {
    [FILE_TYPE.IMAGE]: 'post/images',
    [FILE_TYPE.VIDEO]: 'post/videos',
  },
  [UploadTarget.PROFILE]: {
    [FILE_TYPE.IMAGE]: 'profile/images',
  },
};