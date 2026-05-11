import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AccessClaims {
  sub: string;
  email: string;
  role: 'USER' | 'SUPERADMIN';
  orgId?: string | null;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  signAccess(claims: AccessClaims): Promise<string> {
    return this.jwt.signAsync(claims, { expiresIn: process.env.JWT_ACCESS_TTL ?? '15m' });
  }

  verifyAccess(token: string): Promise<AccessClaims> {
    return this.jwt.verifyAsync<AccessClaims>(token);
  }
}
