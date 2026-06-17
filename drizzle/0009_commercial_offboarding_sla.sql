ALTER TABLE organizations ADD COLUMN ended_at text;
--> statement-breakpoint
ALTER TABLE organizations ADD COLUMN retention_until text;
--> statement-breakpoint
ALTER TABLE organizations ADD COLUMN deletion_scheduled_at text;
--> statement-breakpoint
ALTER TABLE organizations ADD COLUMN deletion_status text NOT NULL DEFAULT 'active';
--> statement-breakpoint
CREATE INDEX idx_organizations_deletion_status ON organizations (deletion_status);
--> statement-breakpoint
CREATE INDEX idx_organizations_deletion_scheduled_at ON organizations (deletion_scheduled_at);
--> statement-breakpoint
CREATE TABLE organization_deletion_requests (
  id text PRIMARY KEY NOT NULL,
  organization_id text NOT NULL,
  requester_id text,
  requested_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reason text,
  source text NOT NULL DEFAULT 'customer_early_request',
  status text NOT NULL DEFAULT 'requested',
  confirmed_by text,
  confirmed_at text,
  execution_scheduled_at text,
  customer_notice text,
  created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (requester_id) REFERENCES user_profiles(id) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (confirmed_by) REFERENCES user_profiles(id) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX idx_org_deletion_requests_org ON organization_deletion_requests (organization_id);
--> statement-breakpoint
CREATE INDEX idx_org_deletion_requests_status ON organization_deletion_requests (status);
--> statement-breakpoint
CREATE INDEX idx_org_deletion_requests_scheduled ON organization_deletion_requests (execution_scheduled_at);
--> statement-breakpoint
CREATE TABLE organization_deletion_runs (
  id text PRIMARY KEY NOT NULL,
  organization_id text NOT NULL,
  deletion_request_id text,
  scope text NOT NULL,
  started_at text NOT NULL,
  completed_at text,
  result text NOT NULL,
  error_summary text,
  customer_evidence text,
  created_at text NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (deletion_request_id) REFERENCES organization_deletion_requests(id) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX idx_org_deletion_runs_org ON organization_deletion_runs (organization_id);
--> statement-breakpoint
CREATE INDEX idx_org_deletion_runs_request ON organization_deletion_runs (deletion_request_id);
--> statement-breakpoint
CREATE INDEX idx_org_deletion_runs_result ON organization_deletion_runs (result);
