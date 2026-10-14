import { z } from 'zod';

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED_PATH = 'UNAUTHORIZED_PATH',
  PATH_TRAVERSAL = 'PATH_TRAVERSAL',
  DATABASE_ERROR = 'DATABASE_ERROR',
  SCANNER_ERROR = 'SCANNER_ERROR',
  PROBE_ERROR = 'PROBE_ERROR',
  INCOMPATIBLE_MEDIA = 'INCOMPATIBLE_MEDIA',
  PLAYBACK_ERROR = 'PLAYBACK_ERROR',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export type AppError = {
  code: ErrorCode;
  message: string;
  details?: unknown;
};

export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

export const ok = <T>(data: T): Result<T, never> => ({
  success: true,
  data,
});

export const err = (code: ErrorCode, message: string, details?: unknown): Result<never, AppError> => ({
  success: false,
  error: { code, message, details },
});

export const ResultSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.discriminatedUnion('success', [
    z.object({
      success: z.literal(true),
      data: dataSchema,
    }),
    z.object({
      success: z.literal(false),
      error: z.object({
        code: z.nativeEnum(ErrorCode),
        message: z.string(),
        details: z.unknown().optional(),
      }),
    }),
  ]);
