export const appConfig = {
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET ?? 'access-secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'refresh-secret',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
};