// src/common/providers/real/hmac-token.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { TokenService } from '../interfaces/token-service.interface.js';

@Injectable()
export class HmacTokenService implements TokenService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('TOKEN_SECRET');
  }

  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  async hash(rawToken: string): Promise<string> {
    return createHmac('sha256', this.secret)
      .update(rawToken)
      .digest('hex');
  }

  async verify(rawToken: string, hash: string): Promise<boolean> {
    const expected = Buffer.from(await this.hash(rawToken), 'hex');
    const actual = Buffer.from(hash, 'hex');
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  }
}