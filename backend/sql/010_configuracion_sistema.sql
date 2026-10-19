-- Configuración común del sistema, administrada únicamente por FastAPI.
-- Tabla expuesta con RLS habilitado; las claves de navegador no reciben permisos.

begin;

create table if not exists public.configuracion_sistema (
    id smallint primary key default 1 check (id = 1),
    settings jsonb not null default '{
        "temperatureMax": 35,
        "humidityMin": 30,
        "humidityMax": 70,
        "airQualityMax": 100,
        "refreshSeconds": 60,
        "staleMinutes": 10,
        "sensorLabel": "ESP32 de la maqueta",
        "notificationsEnabled": true
    }'::jsonb,
    updated_by integer references public.usuarios(id) on delete set null,
    updated_at timestamptz not null default now()
);

alter table public.configuracion_sistema enable row level security;
revoke all on table public.configuracion_sistema from public, anon, authenticated;

insert into public.configuracion_sistema (id)
values (1)
on conflict (id) do nothing;

commit;
