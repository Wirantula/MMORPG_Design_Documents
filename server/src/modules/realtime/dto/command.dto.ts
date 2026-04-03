import { z } from 'zod';

const baseEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['ping', 'action.submit', 'action.cancel', 'chat.send']),
  timestamp: z.string().datetime(),
  payload: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CommandEnvelopeDto = z.infer<typeof baseEnvelopeSchema>;

export function parseCommandEnvelope(input: unknown): CommandEnvelopeDto {
  return baseEnvelopeSchema.parse(input);
}
