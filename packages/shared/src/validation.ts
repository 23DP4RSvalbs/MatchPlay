import { z } from 'zod';
import { sports } from './game';

export const createMatchSchema = z.object({
  venueId: z.string().min(1),
  title: z.string().trim().min(3).max(80),
  sport: z.enum(sports),
  startsAt: z.iso.datetime(),
  capacity: z.number().int().min(1).max(20),
  orangeName: z.string().trim().min(1).max(30).default('Team Orange'),
  blueName: z.string().trim().min(1).max(30).default('Team Blue'),
  durationMinutes: z.number().int().min(1).max(180).default(40),
});
export const joinSchema = z.object({ side: z.enum(['orange', 'blue']) });
export const scoreSchema = z.object({
  side: z.enum(['orange', 'blue']),
  delta: z
    .number()
    .int()
    .min(-3)
    .max(3)
    .refine((n) => n !== 0),
  requestId: z.uuid(),
});
export const chatSchema = z.object({ text: z.string().trim().min(1).max(500) });
export const teamMemberSchema = z.object({ userId: z.string(), side: z.enum(['orange', 'blue']) });
export const venueSchema = z.object({
  name: z.string().trim().min(3).max(100),
  address: z.string().trim().min(3).max(160),
  latitude: z.number().min(55.6).max(58.2),
  longitude: z.number().min(20.7).max(28.3),
  sports: z.array(z.enum(sports)).min(1),
  image: z.enum(['/images/arena.webp', '/images/football.webp']),
  description: z.string().trim().max(500).default(''),
});
export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type VenueInput = z.infer<typeof venueSchema>;
