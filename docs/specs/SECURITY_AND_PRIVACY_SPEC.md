# SECURITY_AND_PRIVACY_SPEC.md

Date: 2026-01-22


## Scope

This document specifies:
- Authentication and authorization design
- Token handling and rotation
- Secrets management
- Privacy posture for sensitive home-layout data
- Hardening/removal of risky capabilities (e.g., remote-exec concepts)

---

## Threat model (high level)

### Sensitive assets
- Floor plans and room layouts (potentially security-sensitive).
- User-generated renders and photos.
- AI prompts/outputs (may contain personal information).
- Account identifiers, sessions, refresh tokens.
- Shared links and collaboration metadata.

### Attack surfaces
- Client device compromise / jailbreak risks.
- Intercepted sessions (network, token theft).
- Web companion sessions (pairing abuse).
- Backend API abuse (scraping, brute force).
- Supply-chain risk via imported assets.
- Any “remote execution / remote tab automation” feature.

---

## Authentication

### Primary: Sign in with Apple + passkeys
- Use Sign in with Apple for account identity.
- Offer passkeys where appropriate for a passwordless experience.
- For web logins, use OAuth best practices for native apps and PKCE.

### Device pairing (web companion)
A pairing flow is acceptable for:
- quickly linking a browser to an already-signed-in iOS device
- supporting “companion mode” where the web app mirrors the device session

Hard requirements:
- pairing codes are short-lived (e.g., 60–120s)
- pairing completion requires device confirmation (push or in-app approval)
- pairing yields a separate web session with scoped permissions
- all sessions can be revoked immediately from the device

---

## Authorization (ACLs)

Minimum ACL model:
- project owner
- editor
- viewer

Optional advanced:
- per-room or per-layer permissions
- time-limited share links (view-only)
- organization/workspace accounts

Enforcement:
- server-side checks on every request
- least privilege scopes on tokens

---

## Session and token design

### Token types
- **Access token**: short-lived (minutes), used on every request.
- **Refresh token**: longer-lived (days/weeks), stored securely, rotated on use.
- **Pairing token**: ephemeral, single-use for web pairing completion.

### Rotation and revocation
- Rotate refresh tokens at every use.
- Maintain a token family and invalidate on suspicious activity.
- Store refresh token hashes server-side, never raw tokens.

### Proof-of-possession (recommended for web)
For high-security posture, bind tokens to clients using DPoP (proof-of-possession) for browser flows.
This reduces replay if an access token leaks.

---

## Client-side secret storage

- Store refresh tokens and sensitive keys in **Keychain**.
- Never embed server secrets or third-party provider secrets in the app bundle.
- Use Apple’s secure enclave / device-bound credentials where possible.

---

## Secrets management (server side)

- All third-party API keys live server-side only.
- Use a managed secrets store (cloud KMS/Secrets Manager/Vault).
- Use per-environment keys; rotate regularly.
- Audit access to secrets and sensitive endpoints.

---

## Data protection and encryption

### In transit
- HTTPS everywhere; HSTS on web.
- WebSockets over WSS.
- Certificate pinning is optional (can increase operational complexity).

### At rest (server)
- Encrypt database volumes and object storage at rest.
- Consider field-level encryption for especially sensitive fields (optional).
- Use strong access controls for backups.

### At rest (device)
- Rely on iOS Data Protection classes.
- Encrypt local DB if needed; tokens always in Keychain.

---

## Privacy posture

### Principles
- Data minimization: collect only what is necessary for product function.
- Purpose limitation: do not reuse sensitive layout data for unrelated purposes.
- Retention: allow users to delete projects; enforce deletion within a defined SLA.
- Transparency: clear privacy labels and in-app disclosure for scanning/AI features.

### Home-layout data handling
Treat floor plans as sensitive:
- default private
- explicit sharing controls
- audit log for sharing/access where feasible

### AI data handling
- Explicit consent for sending user content to third-party AI providers.
- Provide “do not train on my data” setting where vendors support it.
- Offer local-only AI features when feasible (Core ML).

### Data retention policy (server-side defaults)
These defaults apply unless a stricter contractual policy exists:
- Active projects: retained until user deletion.
- Soft-deleted projects: 30-day grace period before hard delete.
- Project ops/event history: retained with project; hard-deleted with project.
- Export packages and render outputs: 30 days after creation, unless pinned by user.
- Audit logs (sharing/access events): 90 days, then aggregated counts only.
- Backups: rolling 35-day window; backups are purged on schedule and included in delete SLA.

### Export workflow ("Export my data")
- Authenticated request triggers a background job to assemble a user-scoped archive.
- Contents: projects + metadata, ops history or latest snapshot, assets (sources + variants),
  export/renders, account profile, and device/session metadata.
- Output: a signed URL with short TTL (e.g., 24 hours), and an audit log entry.
- Rate limit export requests per user and notify on completion.

### Delete workflow ("Delete my data")
- Authenticated request performs a soft delete and starts a retention timer.
- Within the grace period: user can restore; access is blocked to others.
- At grace expiry: hard delete project data, assets, and derived artifacts.
- Delete cascades across related tables and object storage keys.
- Backups: deletion guaranteed within the backup retention window (35 days max).
- User receives confirmation when hard delete completes; log the deletion event.

---

## Hardening or removing “remote exec / remote tab automation”

If the legacy repo contained remote execution/tab automation capabilities:
- Default stance: **remove from product** unless an extremely strong, user-justified case exists.
- If kept as an internal tool:
  - separate admin-only deployment
  - strong auditing
  - strict allowlists (no arbitrary URLs/commands)
  - no access to user projects without explicit consent

---

## Abuse prevention

- Rate limits per IP/device/account.
- Bot detection for public endpoints (signup, pairing).
- Content scanning for uploaded assets where feasible.
- WAF and anomaly monitoring.

---

## References (URLs + access date)

> Access date for all references: 2026-01-22

- Apple Developer Documentation — AuthenticationServices (Sign in with Apple): https://developer.apple.com/documentation/authenticationservices
- Apple Developer Documentation — Sign in with Apple: https://developer.apple.com/sign-in-with-apple/
- RFC 8252 — OAuth 2.0 for Native Apps: https://www.rfc-editor.org/rfc/rfc8252
- RFC 7636 — PKCE: https://www.rfc-editor.org/rfc/rfc7636
- RFC 9449 — DPoP: https://www.rfc-editor.org/rfc/rfc9449
- OWASP MASVS: https://mas.owasp.org/
- Apple Platform Security: https://support.apple.com/guide/security/welcome/web
- Apple Developer Documentation — Keychain Services: https://developer.apple.com/documentation/security/keychain_services
- Apple App privacy details (App Store Connect): https://developer.apple.com/app-store/app-privacy-details/
- GDPR (EU) overview: https://commission.europa.eu/law/law-topic/data-protection/data-protection-eu_en


---

## Appendix A — Data subject requests (GDPR-style)


Even if not legally required in every deployment, implementing these flows improves trust:

- Export my data:
  - projects (snapshots + ops)
  - assets (sources + variants)
  - account metadata
- Delete my data:
  - soft delete with short grace period
  - hard delete on schedule
- Access logs:
  - show sharing events and collaborator access (where feasible)

Implementation notes:
- keep deletion logs for compliance (minimal, non-content)
- cascade deletion through object storage keys

---

## Appendix B — Upload security notes

- Validate file signatures, not just extensions.
- Enforce content-size limits.
- Remove/ignore external URL references inside glTF.
- Optionally scan archives with a malware scanner in workers.
- For shared links, avoid exposing stable asset URLs; always use signed URLs.
