import { SetMetadata } from '@nestjs/common';

export const REQUIRES_OPERATION = 'requires:operation';

export function RequiresOperation(...operations: string[]) {
  return SetMetadata(REQUIRES_OPERATION, operations);
}
