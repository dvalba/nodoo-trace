import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/**
 * Type Guard universal para cualquier driver de TypeORM que devuelva un 'code'
 */
export function isQueryFailedWithCode(
  error: unknown,
): error is QueryFailedError & {
  driverError: { code: string; [key: string]: unknown };
} {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    typeof (error.driverError as Record<string, unknown>).code === 'string'
  );
}

export function handleDbExceptions(error: unknown): never {
  if (isQueryFailedWithCode(error)) {
    if (error.driverError.code === '23505') {
      const driverErr = error.driverError;
      const table = (driverErr.table as string) || 'unknown';
      const detail = (driverErr.detail as string) || 'No detail provided';

      throw new BadRequestException(
        `Duplicate record in table '${table}'. ${detail}`,
      );
    }

    throw new InternalServerErrorException(
      `Database error occurred: ${error.message} (Code: ${error.driverError.code})`,
    );
  }

  // 2. Errores estándar de JavaScript / TypeScript
  if (error instanceof Error) {
    throw new InternalServerErrorException(
      `Unexpected error: ${error.message}`,
    );
  }

  // 3. Fallback crítico por si lanzan algo que no es un Error
  throw new InternalServerErrorException('An unknown critical error occurred.');
}