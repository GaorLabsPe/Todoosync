import { supabaseAdmin } from './supabase';

export async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id')
    .eq('key', apiKey)
    .single();

  if (error || !data) return false;
  return true;
}
