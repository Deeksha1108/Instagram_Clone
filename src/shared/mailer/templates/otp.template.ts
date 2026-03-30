import { COMMON_CONFIG } from 'src/config/common.config';

export const otpTemplate = (otp: string, expiryMinutes: number) => `
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>${COMMON_CONFIG.APP.name} Verification Code</h2>
    <p>Your OTP is:</p>
    <h1 style="letter-spacing: 5px;">${otp}</h1>
    <p>This code will expire in <b>${expiryMinutes} minutes</b>.</p>
    <p>If you didn't request this, please ignore this email.</p>
  </div>
`;