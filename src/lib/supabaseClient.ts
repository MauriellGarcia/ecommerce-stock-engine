import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!rawUrl || !rawAnonKey) {
  console.warn(
    'Atención: Faltan las variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local'
  );
}

// Fallback a URL HTTPS válida para garantizar que createClient no lance una excepción sincrónica al montar la app
const supabaseUrl = rawUrl.startsWith('http')
  ? rawUrl
  : 'https://placeholder.supabase.co';
const supabaseAnonKey = rawAnonKey || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
