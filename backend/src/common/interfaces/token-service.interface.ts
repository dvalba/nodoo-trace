// common/interfaces/token-service.ts
export interface TokenService {
  generate(bytes?: number): string;
  hash(rawToken: string): Promise<string>;             
  verify(rawToken: string, hash: string): Promise<boolean>; 
}

export const TokenService = Symbol('TokenService');