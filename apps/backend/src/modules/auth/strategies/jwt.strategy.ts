import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { AuthedUser } from '../../../common/decorators/current-user.decorator';

const cookieExtractor = (req: Request): string | null => {
  const fromCookie = (req?.cookies as Record<string, string> | undefined)?.['access_token'];
  return fromCookie ?? null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken(), cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    });
  }

  validate(payload: AuthedUser): AuthedUser {
    if (!payload?.sub) throw new UnauthorizedException();
    return payload;
  }
}
