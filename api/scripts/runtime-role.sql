-- Run once as a database administrator after migrations. No login/password is created.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nexus_core_runtime') THEN
  CREATE ROLE nexus_core_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO nexus_core_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON operations, outbox, workspace_history,
 business_products, business_customers, business_sales, business_sale_items,
 business_stock_movements, workspace_sessions TO nexus_core_runtime;
GRANT SELECT ON workspace_users, workspace_memberships, workspace_organizations TO nexus_core_runtime;
GRANT USAGE, SELECT ON SEQUENCE outbox_sequence_seq, business_stock_movements_id_seq TO nexus_core_runtime;
