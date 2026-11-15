-- ============================================================
--  FotoPC v2 · Varios usuarios + registro con código de invitación
--  Pégalo en Supabase → SQL Editor → Run (una sola vez)
-- ============================================================

-- 1) Cada usuario solo ve, sube y borra SUS fotos
drop policy if exists "fotopc_ver"    on storage.objects;
drop policy if exists "fotopc_subir"  on storage.objects;
drop policy if exists "fotopc_editar" on storage.objects;
drop policy if exists "fotopc_borrar" on storage.objects;

create policy "fotopc_ver" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotopc_subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotopc_editar" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotopc_borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2) Código de invitación (nadie puede leerlo desde la app)
create table if not exists public.fotopc_invitacion (codigo text primary key);
alter table public.fotopc_invitacion enable row level security;

-- 👇 CAMBIA ESTE CÓDIGO por el que quieras dar a tus compañeros
insert into public.fotopc_invitacion (codigo) values ('MUESTRAS2026')
on conflict do nothing;

-- 3) Bloquear registros sin código válido
create or replace function public.fotopc_comprobar_invitacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.fotopc_invitacion
    where codigo = coalesce(new.raw_user_meta_data->>'invite', '')
  ) then
    raise exception 'Codigo de invitacion incorrecto';
  end if;
  return new;
end;
$$;

drop trigger if exists fotopc_invitacion_trg on auth.users;
create trigger fotopc_invitacion_trg
  before insert on auth.users
  for each row execute function public.fotopc_comprobar_invitacion();

-- ------------------------------------------------------------
-- Más adelante:
--   Cambiar el código:  update public.fotopc_invitacion set codigo = 'NUEVO';
--   Cerrar registros:   delete from public.fotopc_invitacion;
-- ------------------------------------------------------------
