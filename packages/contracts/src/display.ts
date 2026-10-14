import { z } from 'zod';

export const DisplayBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type DisplayBounds = z.infer<typeof DisplayBoundsSchema>;

export const DisplayInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  bounds: DisplayBoundsSchema,
  isPrimary: z.boolean(),
  scaleFactor: z.number(),
});
export type DisplayInfo = z.infer<typeof DisplayInfoSchema>;

export const AssignDisplaysSchema = z.object({
  operatorDisplayId: z.string().nullable(),
  publicDisplayId: z.string().nullable(),
});
export type AssignDisplaysDTO = z.infer<typeof AssignDisplaysSchema>;
