// Variables publicas (van al navegador): solo URL y clave publica de Supabase.
// La service role y la clave de OpenAI se leen exclusivamente en el servidor.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
