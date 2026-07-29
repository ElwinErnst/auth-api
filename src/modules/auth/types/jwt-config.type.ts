export type JwtConfig = {
  issuer: string;
  audience: string;
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
};
