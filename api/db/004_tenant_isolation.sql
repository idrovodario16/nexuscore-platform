-- The API sets this context locally inside each transaction, after authorization.
DO $$
DECLARE table_name text;
BEGIN
 FOREACH table_name IN ARRAY ARRAY['operations','outbox','workspace_history',
  'business_products','business_customers','business_sales','business_sale_items','business_stock_movements']
 LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING
   (organization_id = NULLIF(current_setting(''nexus.organization_id'', true), '''')::uuid)
   WITH CHECK (organization_id = NULLIF(current_setting(''nexus.organization_id'', true), '''')::uuid)', table_name);
 END LOOP;
END $$;
