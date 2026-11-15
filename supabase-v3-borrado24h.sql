-- ============================================================
--  FotoPC v3 · Borrado automático EN EL SERVIDOR
--  Cada hora borra todo lo que lleve más de 24 h sin descargar,
--  aunque nadie abra la app.
--  Pégalo en Supabase → SQL Editor → Run (UNA sola vez)
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 👇 1) Tu URL (la misma de config.js)
select vault.create_secret('https://TU-PROYECTO.supabase.co', 'fotopc_url');

-- 👇 2) Tu clave service_role
--    Project Settings → API Keys → pestaña "Legacy API Keys" → service_role → Reveal → copiar
--    Se guarda CIFRADA en el Vault de Supabase. NUNCA la pongas en config.js ni en GitHub.
select vault.create_secret('PEGA_AQUI_LA_SERVICE_ROLE_KEY', 'fotopc_service_key');

create or replace function public.fotopc_purgar()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  k text;
  obj record;
  n int := 0;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'fotopc_url';
  select decrypted_secret into k    from vault.decrypted_secrets where name = 'fotopc_service_key';
  for obj in
    select name from storage.objects
    where bucket_id = 'fotos' and created_at < now() - interval '24 hours'
    limit 500
  loop
    perform net.http_delete(
      url     := base || '/storage/v1/object/fotos/' || replace(obj.name, ' ', '%20'),
      headers := jsonb_build_object('apikey', k, 'Authorization', 'Bearer ' || k)
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Nadie puede llamarla desde la app
revoke execute on function public.fotopc_purgar() from public, anon, authenticated;

-- Programar: cada hora en punto
select cron.schedule('fotopc-borrar-24h', '0 * * * *', 'select public.fotopc_purgar()');

-- ------------------------------------------------------------
-- Comprobar que está programado:  select * from cron.job;
-- Ver las últimas ejecuciones:     select * from cron.job_run_details order by start_time desc limit 5;
-- Desactivarlo:                    select cron.unschedule('fotopc-borrar-24h');
-- ------------------------------------------------------------
