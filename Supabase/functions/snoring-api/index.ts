import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { createApplication } from './app.js';
import { createHandler } from './handler.js';

const env = (name: string) => Deno.env.get(name) || '';
const client = createClient(env('SUPABASE_URL'), env('APP_SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false }
});
const app = createApplication({ env, storage: client.storage });
Deno.serve(createHandler({ app, env }));
