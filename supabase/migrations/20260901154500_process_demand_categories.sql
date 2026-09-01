alter table public.processos_administrativos
  add column if not exists tipo_demanda text not null default 'OUTROS';

comment on column public.processos_administrativos.tipo_demanda is
  'Categoria estruturada da demanda administrativa para indicadores e relatórios.';

create index if not exists idx_processos_tipo_demanda
  on public.processos_administrativos (tipo_demanda);

create index if not exists idx_processos_municipio_status
  on public.processos_administrativos (municipio, status_processo);
