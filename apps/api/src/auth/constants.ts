const configuredSecret = process.env.JWT_SECRET ?? process.env.IBRA_JWT_SECRET;

if (process.env.NODE_ENV === 'production' && !configuredSecret) {
  throw new Error('JWT_SECRET must be configured in production.');
}

export const jwtConstants = {
  secret: configuredSecret ?? 'ibra-ba-local-secret-change-me',
  expiresIn: '8h' as const,
};
