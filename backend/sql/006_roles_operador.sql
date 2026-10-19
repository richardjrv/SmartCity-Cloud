-- Add the intermediate operator role. Existing role ids are admin=1, usuario=2.
-- This insert is repeatable and lets the roles sequence assign the next id.
insert into public.roles (nombre, descripcion)
values (
    'operador',
    'Consulta sensores y da seguimiento a reportes y alertas; no gestiona cuentas ni actuadores.'
)
on conflict (nombre) do update
set descripcion = excluded.descripcion;

do $$
begin
    if not exists (select 1 from public.roles where id = 3 and nombre = 'operador') then
        raise exception 'El rol operador debe conservar id_rol=3 para coincidir con los permisos de la API.';
    end if;
end;
$$;
