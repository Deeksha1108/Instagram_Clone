export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET as string,
  refreshSecret: process.env.JWT_REFRESH_SECRET as string,
  expiresIn: Number(process.env.JWT_EXPIRES_IN),
  refreshExpiresIn: Number(process.env.JWT_REFRESH_EXPIRES_IN),
};