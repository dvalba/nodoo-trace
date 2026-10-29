import { Injectable } from '@nestjs/common';
import { TokenService } from '../interfaces/token-service.interface.js';

@Injectable()
export class FakeTokenService implements TokenService {
  private counter = 0;
  readonly issued: string[] = [];

  generate(): string {
    const token = `fake-token-${++this.counter}`;
    this.issued.push(token);
    return token;
  }

  async hash(rawToken: string): Promise<string> {
    return `fake-hash:${rawToken}`;
  }

  async verify(rawToken: string, hash: string): Promise<boolean> {
    return (await this.hash(rawToken)) === hash;
  }
}
