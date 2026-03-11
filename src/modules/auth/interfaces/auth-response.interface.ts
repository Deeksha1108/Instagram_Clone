export interface ApiResponse<T> {
  message: string;
  data?: T;
}

export interface SendOtpResponse {
  tempToken: string;
}

export interface VerifyOtpResponse {
  verified: boolean;
}

export interface CreateProfileResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
}
