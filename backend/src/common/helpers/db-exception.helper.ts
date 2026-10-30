import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

export const DB_ERROR_CODE = {
  UNIQUE_VIOLATION: '23505',
} as const;

export type DbError = QueryFailedError & {
  driverError: { code: string; [key: string]: unknown };
};

export type DbExceptionMapper = (error: DbError) => HttpException;

export interface HandleDbExceptionOptions {
  mappers?: Partial<Record<string, DbExceptionMapper>>;
}

/**
 * Type Guard universal para cualquier driver de TypeORM que devuelva un 'code'
 */
export function isQueryFailedWithCode(error: unknown): error is DbError {
  return (
    error instanceof QueryFailedError &&
    typeof error.driverError === 'object' &&
    error.driverError !== null &&
    'code' in error.driverError &&
    typeof (error.driverError as Record<string, unknown>).code === 'string'
  );
}

const defaultMappers: Record<string, DbExceptionMapper> = {
  [DB_ERROR_CODE.UNIQUE_VIOLATION]: (error) => {
    const table = (error.driverError.table as string) || 'unknown';
    const detail = (error.driverError.detail as string) || 'No detail provided';

    return new BadRequestException(
      `Duplicate record in table '${table}'. ${detail}`,
    );
  },
};

/**
 * Traduce errores de base de datos a excepciones HTTP.
 *
 * Abierto a extensión: recibe mappers por código de error que sobrescriben
 * los defaults para ese código, sin alterar el comportamiento del resto de
 * callers.
 */
export function handleDbExceptions(
  error: unknown,
  options: HandleDbExceptionOptions = {},
): never {
  if (isQueryFailedWithCode(error)) {
    const mapper =
      options.mappers?.[error.driverError.code] ??
      defaultMappers[error.driverError.code];

    if (mapper) throw mapper(error);

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
