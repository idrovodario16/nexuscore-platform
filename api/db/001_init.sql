CREATE TABLE IF NOT EXISTS operations (
 id uuid PRIMARY KEY, organization_id uuid NOT NULL,title varchar(120) NOT NULL CHECK(length(trim(title))>=3),
 sector text NOT NULL CHECK(sector IN ('logistics','retail','services')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','completed','cancelled')),
 amount_cents integer NOT NULL CHECK(amount_cents BETWEEN 0 AND 1000000000), revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX IF NOT EXISTS operations_org_date ON operations(organization_id,created_at DESC,id);
CREATE TABLE IF NOT EXISTS outbox (sequence bigserial PRIMARY KEY,organization_id uuid NOT NULL,event jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE INDEX IF NOT EXISTS outbox_org_sequence ON outbox(organization_id,sequence);
