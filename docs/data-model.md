# Nova Systems — Data Model

**Date:** 2026-09-20. Reflects the LIVE Supabase schema, verified via direct PostgREST OpenAPI
introspection this session — not assumed from `schema-update.sql` or `schema.sql` in either repo,
both of which have been proven to drift from production before. Treat this document the same way:
re-verify live before trusting it if significant time has passed.

## Identity / tenancy (shared with `nova-wave-one`, extended here)

- **`organizations`** — `id, name, slug, kind ('nova_internal'|'client'), client_id, status,
  created_at, updated_at`. One real row today: Nova Systems (`kind='nova_internal'`).
- **`organization_members`** — `id, organization_id, member_type ('staff'|'client_account'),
  staff_user_id, client_account_id, role, status, permissions (jsonb, unused), created_at`. Role
  is a CHECK-constrained enum: `nova_super_admin, nova_admin, nova_auditor, nova_marketing,
  nova_sales, nova_developer, client_owner, client_admin, client_marketing, client_employee,
  client_viewer`. Every real login uses `member_type='staff'` — see `architecture.md` ADR-1.
- **`permissions`** — `id, key, description, created_at`. 16 seeded keys:
  `overview.view, intelligence.view, growth.view, execution.view, companies.view, admin.view,
  members.view, members.manage, locations.view, locations.manage, documents.view,
  documents.manage, billing.view, billing.manage, settings.view, settings.manage`.
- **`role_permissions`** — `id, role, permission_id, created_at`. Live role→permission bundles
  (post-Stage-4.1 fix): `nova_super_admin`/`nova_admin` get all 16; `client_owner`/`client_admin`
  get only `overview/intelligence/growth/execution/companies.view` (5, no `admin.view` or any
  `.manage`); `client_marketing` gets `overview/growth.view`; `client_employee` gets
  `overview/execution.view`; `client_viewer` gets `overview.view` only.
- **`locations`** — `id, organization_id, name, address, city, state, postal_code, country,
  status, created_at, updated_at`. Built Stage 4, no rows yet, no UI built on top of it yet.
- **`organization_settings`**, **`organization_integrations`**, **`activity_log`**, **`audit_log`**
  — from `nova-wave-one`'s original migration, exist, mostly unused by this repo so far.

## Real operating data (Stage 5, organization-scoped)

Each of these got an additive `organization_id UUID REFERENCES organizations(id)` column, backfilled
to Nova Systems for every existing row, RLS enabled via `is_org_member(organization_id)`:

- **`leads`** — `id, name, email, phone, company, service_needed, intake_completed,
  intake_submission_id, created_at, website, industry, challenge, goal, agreed_to_terms,
  sms_consent, email_consent, call_consent, organization_id`. 1 real row (Isaac's own test).
- **`intake_submissions`** — `id, name, email, phone, ..., status, created_at, lead_id, ...,
  organization_id`. 0 rows. Fed by `/intake` → `api/business-intake.js` (real, working).
- **`contracts`** — `id, client_name, client_email, contract_type, custom_notes, status, sent_at,
  signed_at, signed_name, signature_data, pdf_url, created_at, organization_id`. 1 row, literally
  named "QA Test Client — DELETE ME."
- **`client_invoices`** — `id, client_id, invoice_number, line_items, subtotal, tax, total,
  deposit_amount, due_date, notes, status, created_at, stripe_payment_link,
  stripe_payment_intent, invoice_pdf_url, paid_at, organization_id`. 0 rows.
- **`clients`** — `id, full_name, business_name, phone, email, business_address, business_type,
  current_website, referral_source, tier_name, tier_price, intake_data, signature_data_url,
  status, language, created_at, contract_url, stripe_customer_id, stripe_session_id,
  payment_status, first_payment_date, organization_id`. 0 rows.
- **`meetings`** — `id, client_id, meeting_type, date, time, notes, status, created_at,
  organization_id`. 0 rows.
- **`nova_tasks`** — `id, engine, title, description, contact_id, source_recommendation_id,
  assigned_to, trigger_type, status, created_at, completed_at, organization_id`. Shared with
  `nova-wave-one`'s engines (writes on trigger). 0 rows.
- **`referral_tracking`** — `id, rep_name, rep_email, client_id, client_name, deal_value,
  commission_rate, commission_amount, status, retention_bonus_paid, created_at, organization_id`.
  0 rows.

## Deliberately NOT organization-scoped

- **`blog_posts`** (35 rows) and **`portfolio`** (0 rows) — public website marketing content,
  platform-global by design (`blog_posts.site` defaults to `'nova'`, confirming intent). Adding
  `organization_id` here would be modeling them as tenant data when they're not.

## Recruitment (real table, incomplete surface)

- **`applications`** — real careers-applicant data. Read path is real (`Jobs.jsx` via
  `api/intake.js`); write path (status/notes changes) currently only persists to
  `localStorage['nova_applications']`, never PATCHed back to Supabase — a real bug, not yet fixed.

## `nova-wave-one`-shared engine tables (present, mostly from that repo's own engines)

`nova_crm_contacts` (3 rows, automated cold-scan artifacts), `nova_crm_deals` (0),
`nova_crm_activities` (9 rows), plus ~40 more `nova_*` tables (ai_agents, flow_workflows,
tron_trends, social_posts, etc.) from `nova-wave-one`'s engine suite. Not inventoried in depth
this session — these belong to a different app's domain model; do not assume they're safe to
reuse for Nova-Systems-native features without checking for the same kind of surprises found
elsewhere (orphaned writers, mismatched shapes) first.

## Helper functions (SECURITY DEFINER, live)

- `is_platform_owner()` — `role='nova_super_admin' AND status='active'` for `auth.uid()`.
- `is_org_member(target_org_id)` — real per-organization membership check, no blanket shortcut.
- `has_permission(target_org_id, permission_key)` — joins `organization_members` → `role_permissions`
  → `permissions`, checks the real stored role, not any client-supplied claim.

## Schema-shape gotcha worth remembering

`permissions`/`role_permissions` originally drafted with a `permission_key TEXT` direct reference
design; what's actually live uses surrogate `id` UUIDs with `role_permissions.permission_id` as
the FK. Confirmed via live introspection after a written migration turned out to have been applied
in an adapted form by someone/something other than a literal copy-paste of the drafted SQL. Lesson
already internalized in `architecture.md` ADR-4 and this document: verify live, always.
