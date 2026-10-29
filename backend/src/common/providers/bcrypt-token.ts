// common/providers/real/bcrypt-token.service.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { TokenService } from '../interfaces/token-service.interface.js';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class BcryptTokenService implements TokenService {
  generate(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }
  hash(rawToken: string): Promise<string> {
    return bcrypt.hash(rawToken, BCRYPT_ROUNDS);
  }
  async verify(rawToken: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(rawToken, hash);
    } catch {
      return false;
    }
  }
}
