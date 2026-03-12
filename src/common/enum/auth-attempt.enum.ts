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