create table if not exists conversation_memory (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  conversation_id text not null unique,
  resource_id text,
  customer_type text check (
    customer_type in ('vendedor', 'comprador', 'improdutivo', 'parceiro_afiliado', 'imprensa', 'funcionario')
  ),
  problem_summary text,
  data_needed jsonb,
  data_collected jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversation_memory_tenant_id_idx on conversation_memory (tenant_id);
create index if not exists conversation_memory_resource_id_idx on conversation_memory (resource_id);
