CREATE TABLE IF NOT EXISTS workspace_organizations (
 id uuid PRIMARY KEY,
 name text NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_users (
 id uuid PRIMARY KEY,
 email text NOT NULL UNIQUE,
 name text NOT NULL,
 password_hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
 organization_id uuid REFERENCES workspace_organizations(id),
 user_id uuid REFERENCES workspace_users(id),
 role text NOT NULL CHECK (role IN ('operator', 'supervisor', 'admin')),
 PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspace_sessions (
 token_hash text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES workspace_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS workspace_sessions_expiry ON workspace_sessions(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS operations_org_id ON operations(organization_id, id);

CREATE TABLE IF NOT EXISTS workspace_history (
 organization_id uuid NOT NULL REFERENCES workspace_organizations(id),
 operation_id uuid NOT NULL,
 revision integer NOT NULL,
 actor_id uuid NOT NULL REFERENCES workspace_users(id),
 actor_name text NOT NULL,
 previous_status text,
 status text NOT NULL,
 occurred_at timestamptz NOT NULL,
 PRIMARY KEY (organization_id, operation_id, revision),
 FOREIGN KEY (organization_id, operation_id) REFERENCES operations(organization_id, id)
);
