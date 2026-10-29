import { NotFoundException } from '@nestjs/common';

// 'Invitation not found, expired or already used';

export function throwNotFound(entity: string, value: string | number | undefined = undefined , field = 'id'): never {
  const msgError = value ? `${entity} not found with ${field}:${value}.` : `${entity} not found.`
  throw new NotFoundException(msgError);
}


