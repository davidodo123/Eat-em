-- Correos de la app (confirmar cuenta, enlace de acceso, recuperar contrasena) enviados por
-- nuestro SMTP, no por Supabase. Limite propio para que nadie use la web para mandar correos
-- en masa: por email, 1 por minuto y 5 por hora; por IP, 20 por hora.
CREATE TABLE IF NOT EXISTS envios_correo (
  id         BIGSERIAL PRIMARY KEY,
  email      TEXT NOT NULL,
  ip         TEXT,
  tipo       TEXT NOT NULL CHECK (tipo IN ('confirmar','enlace','recuperar')),
  enviado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS envios_correo_email_idx ON envios_correo (email, enviado_en DESC);
CREATE INDEX IF NOT EXISTS envios_correo_ip_idx ON envios_correo (ip, enviado_en DESC);

-- Solo el servidor (service role) la usa: sin politicas, nadie mas puede leerla ni escribirla
ALTER TABLE envios_correo ENABLE ROW LEVEL SECURITY;

-- Apunta el envio si esta dentro del limite y devuelve si se puede enviar
CREATE OR REPLACE FUNCTION public.reservar_envio_correo(p_email TEXT, p_ip TEXT, p_tipo TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM envios_correo WHERE email = p_email AND enviado_en > now() - interval '1 minute')
     OR (SELECT count(*) FROM envios_correo WHERE email = p_email AND enviado_en > now() - interval '1 hour') >= 5
     OR (p_ip IS NOT NULL AND (SELECT count(*) FROM envios_correo WHERE ip = p_ip AND enviado_en > now() - interval '1 hour') >= 20)
  THEN
    RETURN false;
  END IF;
  INSERT INTO envios_correo (email, ip, tipo) VALUES (p_email, p_ip, p_tipo);
  DELETE FROM envios_correo WHERE enviado_en < now() - interval '2 days';
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.reservar_envio_correo(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ¿Hay una cuenta con este email? Pedir un enlace de acceso para un email desconocido crearia
-- la cuenta (generateLink magiclink), asi que antes se comprueba. Solo para el servidor.
CREATE OR REPLACE FUNCTION public.existe_cuenta(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email) AND deleted_at IS NULL)
$$;
REVOKE EXECUTE ON FUNCTION public.existe_cuenta(TEXT) FROM PUBLIC, anon, authenticated;
