-- ============================================================
--  FotoPC · Configuración de Supabase
--  Pégalo en Supabase → SQL Editor → Run (una sola vez)
-- ============================================================

-- 1) Bucket PRIVADO llamado "fotos"
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

-- 2) Solo usuarios con sesión iniciada pueden ver / subir / borrar
create policy "fotopc_ver"    on storage.objects for select to authenticated using (bucket_id = 'fotos');
create policy "fotopc_subir"  on storage.objects for insert to authenticated with check (bucket_id = 'fotos');
create policy "fotopc_editar" on storage.objects for update to authenticated using (bucket_id = 'fotos');
create policy "fotopc_borrar" on storage.objects for delete to authenticated using (bucket_id = 'fotos');

-- IMPORTANTE: después ve a Authentication → Sign In / Providers
-- y DESACTIVA "Allow new users to sign up", para que nadie más pueda crearse cuenta.
