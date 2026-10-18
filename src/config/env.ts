import { z } from 'zod';

const schema = z
  .object({
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_KEY: z.string().min(20),
    DATABASE_URL: z.string().startsWith('postgres'),
    GEMINI_API_KEY: z.string().min(10),
    GEMINI_MODEL: z.string().min(3),
    PORT: z.coerce.number().default(3001),
    NODE_ENV: z.string().default('development'),
    CORS_ORIGINS: z.string().optional(),
    DAILY_GENERATION_LIMIT: z.coerce.number().int().positive().default(50),
    USER_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(10),
  })
  .refine((e) => e.NODE_ENV !== 'production' || !!e.CORS_ORIGINS, {
    message: 'CORS_ORIGINS is required in production',
    path: ['CORS_ORIGINS'],
  });

export function validateEnv(raw: Record<string, unknown>) {
  const r = schema.safeParse(raw);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${lines}`);
  }
  return { ...raw, ...r.data };
}