export enum AttemptType {
  SIGNUP = 'signup',
  LOGIN = 'login',
  FORGOT_PASSWORD = 'forgot_password',
}

export enum AttemptStatus {
  INVALID_USER = 'invalid_user',
  WRONG_PASSWORD = 'wrong_password',
  USER_ALREADY_EXISTS = 'user_already_exists',
}

export enum Gender {
  MALE = 1,
  FEMALE = 2,
  OTHER = 3,
}

export enum OtpType {
  SIGNUP = 'SIGNUP',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
}
