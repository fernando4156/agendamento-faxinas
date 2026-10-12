-- =============================================================================
-- Executado automaticamente apenas no PRIMEIRO boot do container Postgres.
-- Cria os bancos logicos usados pela Evolution API e pelo n8n.
-- O banco definido em POSTGRES_DB ja e criado pela imagem oficial.
-- =============================================================================

CREATE DATABASE evolution;
CREATE DATABASE n8n;
