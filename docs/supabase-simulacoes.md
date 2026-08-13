# Persistência das simulações no Supabase

A seção **Simulação de viabilidade** usa a tabela `public.viability_scenarios`.

## Aplicar a migração

No painel do projeto Supabase usado pela aplicação:

1. Abra **SQL Editor**.
2. Copie o conteúdo de
   `supabase/migrations/20260813000000_create_viability_scenarios.sql`.
3. Execute o SQL uma única vez.
4. Publique a versão atualizada da aplicação.

Depois disso, novos cenários serão salvos no Supabase e aparecerão em outros
navegadores e dispositivos. Na primeira carga, cenários existentes no
armazenamento local do navegador são enviados automaticamente para a tabela.

## Modelo de acesso

A aplicação atual não possui login. Por isso, as políticas da migração permitem
leitura, criação e exclusão para os papéis `anon` e `authenticated`, seguindo o
mesmo acesso público já usado pelo painel. Isso significa que os cenários são
compartilhados entre todos os visitantes da aplicação.

Para separar cenários por usuário, primeiro será necessário implementar
autenticação e adicionar uma coluna `user_id` com políticas RLS por usuário.
