-- Business registration. Run AFTER revive-proof-migration-standalone.sql. Safe to re-run.
-- 1) A business asks to join (business_registrations). Nothing else is created until a Nova
--    administrator approves it.
-- 2) A new permission, business.manage: set prices, offers, agreement wording, record payments
--    and edit the assistant for ONE organization. Every endpoint behind it is organization-scoped
--    (api/_journey.js, api/_businessAgent.js), which is why it is safe to give to client owners.
--    admin.view is NOT given to client roles: it still guards Nova's own company-wide screens.

CREATE TABLE IF NOT EXISTS business_registrations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name    TEXT NOT NULL,
  industry_pack    TEXT,                       -- a key from api/_industryPacks.js, or NULL
  contact_name     TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  message          TEXT,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  organization_id  UUID REFERENCES organizations(id),  -- set as soon as the organization exists
  owner_user_id    UUID,                               -- set once the owner has a login
  owner_access     TEXT CHECK (owner_access IS NULL OR owner_access IN ('existing_login', 'invite_emailed')),
  decided_by       TEXT,
  decided_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- The same person asking twice for the same business is one request.
CREATE UNIQUE INDEX IF NOT EXISTS business_registrations_open_idx
  ON business_registrations (lower(email), lower(business_name)) WHERE status = 'pending';
ALTER TABLE business_registrations ENABLE ROW LEVEL SECURITY; -- no policies: server (service role) only

INSERT INTO permissions (key, description) VALUES
  ('business.manage', 'Set prices, offers, agreement wording and the assistant for one organization')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT r.role, p.id FROM permissions p,
  (VALUES ('nova_super_admin'), ('nova_admin'), ('client_owner'), ('client_admin')) AS r(role)
WHERE p.key = 'business.manage'
ON CONFLICT DO NOTHING;
