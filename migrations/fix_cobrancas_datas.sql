-- Migration idempotente para normalizar datas corrompidas em cobrancas.
-- Se a coluna ainda for texto, converte formatos claros para YYYY-MM-DD.
-- Se a data não puder ser inferida com segurança, define NULL.

begin;

create or replace function public.try_parse_cobrancas_date(value text)
returns date
language plpgsql
immutable
strict
as $$
declare
  cleaned text;
  parsed_date date;
begin
  if value ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      parsed_date := value::date;
      return parsed_date;
    exception when others then
      return null;
    end;
  end if;

  if value ~ '^\d{2}/\d{2}/\d{4}$' then
    begin
      parsed_date := to_date(value, 'DD/MM/YYYY');

      if to_char(parsed_date, 'DD/MM/YYYY') = value then
        return parsed_date;
      end if;
    exception when others then
      return null;
    end;
  end if;

  if value ~ '^\d{4}/\d{2}/\d{2}$' then
    begin
      parsed_date := to_date(value, 'YYYY/MM/DD');

      if to_char(parsed_date, 'YYYY/MM/DD') = value then
        return parsed_date;
      end if;
    exception when others then
      return null;
    end;
  end if;

  if value ~ '^\d{2}-\d{2}-\d{4}$' then
    begin
      parsed_date := to_date(value, 'DD-MM-YYYY');

      if to_char(parsed_date, 'DD-MM-YYYY') = value then
        return parsed_date;
      end if;
    exception when others then
      return null;
    end;
  end if;

  if value ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      parsed_date := value::date;
      return parsed_date;
    exception when others then
      return null;
    end;
  end if;

  cleaned := regexp_replace(value, '\D', '', 'g');

  if cleaned ~ '^\d{8}$' then
    begin
      parsed_date := to_date(cleaned, 'YYYYMMDD');

      if to_char(parsed_date, 'YYYYMMDD') = cleaned then
        return parsed_date;
      end if;
    exception when others then
      null;
    end;

    begin
      parsed_date := to_date(cleaned, 'DDMMYYYY');

      if to_char(parsed_date, 'DDMMYYYY') = cleaned then
        return parsed_date;
      end if;
    exception when others then
      null;
    end;
  end if;

  return null;
end;
$$;

do $$
declare
  target_column text;
begin
  select c.column_name
  into target_column
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'cobrancas'
    and c.column_name in ('data_vencimento', 'vencimento')
    and c.data_type in ('text', 'character varying')
  order by case c.column_name when 'data_vencimento' then 1 else 2 end
  limit 1;

  if target_column is null then
    raise notice 'Nenhuma coluna de vencimento em texto encontrada em public.cobrancas.';
    return;
  end if;

  execute format($sql$
    update public.cobrancas
       set %1$I = case
         when public.try_parse_cobrancas_date(%1$I) is null then null
         else to_char(public.try_parse_cobrancas_date(%1$I), 'YYYY-MM-DD')
       end
     where %1$I is not null
       and %1$I is distinct from case
         when public.try_parse_cobrancas_date(%1$I) is null then null
         else to_char(public.try_parse_cobrancas_date(%1$I), 'YYYY-MM-DD')
       end;
  $sql$, target_column);
end
$$;

commit;