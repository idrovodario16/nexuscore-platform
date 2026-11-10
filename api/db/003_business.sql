CREATE TABLE business_products (
 organization_id uuid NOT NULL REFERENCES workspace_organizations(id),
 id uuid NOT NULL,
 sku text NOT NULL,
 name text NOT NULL,
 price_cents integer NOT NULL CHECK (price_cents BETWEEN 1 AND 1000000000),
 stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,sku)
);

CREATE TABLE business_customers (
 organization_id uuid NOT NULL REFERENCES workspace_organizations(id),
 id uuid NOT NULL,
 name text NOT NULL,
 contact text NOT NULL,
 PRIMARY KEY (organization_id,id)
);

CREATE TABLE business_sales (
 organization_id uuid NOT NULL,
 id uuid NOT NULL,
 customer_id uuid NOT NULL,
 shipment_id uuid NOT NULL,
 total_cents integer NOT NULL CHECK (total_cents BETWEEN 1 AND 1000000000),
 created_by uuid NOT NULL REFERENCES workspace_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 paid_at timestamptz,
 paid_by uuid REFERENCES workspace_users(id),
 payment_method text CHECK (payment_method IN ('cash','transfer','card')),
 cancelled_at timestamptz,
 PRIMARY KEY (organization_id,id),
 UNIQUE (organization_id,shipment_id),
 FOREIGN KEY (organization_id,customer_id) REFERENCES business_customers(organization_id,id),
 FOREIGN KEY (organization_id,shipment_id) REFERENCES operations(organization_id,id)
);
CREATE INDEX business_sales_recent ON business_sales(organization_id,created_at DESC,id);

CREATE TABLE business_sale_items (
 organization_id uuid NOT NULL,
 sale_id uuid NOT NULL,
 product_id uuid NOT NULL,
 quantity integer NOT NULL CHECK (quantity > 0),
 unit_price_cents integer NOT NULL CHECK (unit_price_cents > 0),
 PRIMARY KEY (organization_id,sale_id,product_id),
 FOREIGN KEY (organization_id,sale_id) REFERENCES business_sales(organization_id,id),
 FOREIGN KEY (organization_id,product_id) REFERENCES business_products(organization_id,id)
);

CREATE TABLE business_stock_movements (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id uuid NOT NULL,
 product_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES workspace_users(id),
 delta integer NOT NULL CHECK (delta <> 0),
 kind text NOT NULL CHECK (kind IN ('receipt','sale','cancellation')),
 reference text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (organization_id,product_id) REFERENCES business_products(organization_id,id)
);
CREATE INDEX business_movements_recent ON business_stock_movements(organization_id,id DESC);
