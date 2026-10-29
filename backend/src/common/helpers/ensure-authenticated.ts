// common/auth/ensure-authenticated.ts
import { UnauthorizedException } from '@nestjs/common';

type ErrorRule = {
  match: (error: unknown) => boolean;
  message: string;
  onFail?: () => void;
};

type ValueRule<T> = {
  check: (value: T) => boolean;
  message: string;
  onFail?: () => void;
};

type Rules<T> = { catches?: ErrorRule[]; passes?: ValueRule<T>[] };

export async function ensureAuthenticated<T>(
  promise: Promise<T>,
  rules: Rules<T>,
): Promise<T> {
  let value: T;

  try {
    value = await promise;
  } catch (error) {
    for (const rule of rules.catches ?? []) {
      if (rule.match(error)) {
        rule.onFail?.();
        throw new UnauthorizedException(rule.message);
      }
    }
    throw error;
  }

  for (const rule of rules.passes ?? []) {
    if (!rule.check(value)) {
      rule.onFail?.();
      throw new UnauthorizedException(rule.message);
    }
  }

  return value;
}
