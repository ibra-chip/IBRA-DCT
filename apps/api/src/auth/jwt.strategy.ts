import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { jwtConstants } from './constants';

export interface JwtPayload {
  sub: string;
  email: string;
  name?: string;
  role: string;
  company?: string;
  companyId?: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  role: string;
  company: string;
  companyId?: string;
}

const cookieExtractor = (request: { headers?: { cookie?: string } }) => {
  const cookieHeader = request.headers?.cookie ?? '';
  const sessionCookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('ibra_session='));

  return sessionCookie ? decodeURIComponent(sessionCookie.slice('ibra_session='.length)) : null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      role: payload.role,
      company: payload.company ?? '',
      companyId: payload.companyId,
    };
  }
}
