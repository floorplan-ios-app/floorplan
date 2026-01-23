# DEVICE_PAIRING_SPEC.md

Date: 2026-01-23

## Scope

Defines the device pairing and companion-session workflow for linking web/iPad devices to a primary iOS device without requiring full account login. This spec augments the auth sections of BACKEND/SECURITY and is the source of truth for pairing endpoints, token scopes, and UX requirements.

## Goals

- Fast pairing flow (seconds) with strong security guarantees.
- Short-lived, single-use pairing codes.
- Optional approval on the primary device for sensitive pairings.
- Server-issued session tokens with scoped privileges and revocation.
- Auditability (pairing events logged).

## Entities

- **Pairing code**: short-lived, one-time code associated with a user + device session.
- **Device session**: server-side record of a client device (type, name, last seen, token family).
- **Access token**: short-lived bearer token for API calls.
- **Refresh token**: long-lived token stored in Keychain, rotated on use.

## API Endpoints (v1)

- `POST /v1/pairing/create`
  - Auth: existing session required (primary device).
  - Returns: `{ code, expiresAt, pairingId }` and optional `{ qr }` (encoded URL).
  - Constraints: one active code per user unless explicitly requested.

- `POST /v1/pairing/complete`
  - Body: `{ code, deviceName?, deviceType? }`.
  - Returns: `{ accessToken, refreshToken, accessExpiresAt, refreshExpiresAt, deviceId }`.
  - Side effects: invalidates code, creates device session, emits pairing audit log, notifies primary device (if online).

- `GET /v1/devices`
  - Returns list of paired devices with last activity.

- `POST /v1/devices/:id/revoke`
  - Revokes a device session and invalidates token family.

- `POST /v1/auth/refresh`
  - Standard refresh flow for all sessions (including paired devices).

## Security Requirements

- Pairing codes are CSPRNG-generated, 6–8 chars, **single-use**, **short-lived** (60–300s).
- Rate-limit pairing attempts by IP + user; lockout after repeated failures.
- All pairing requests require TLS; codes never transmitted over insecure channels.
- Tokens are rotated on refresh; token family invalidated on suspicious activity.
- Optional approval step: primary device must confirm the pairing before completion (configurable per account).
- Device sessions are revocable immediately; revocation is propagated via WS if device is online.

## UX Requirements

- iOS: “Add device” shows code + QR, indicates expiry, offers “Revoke all pairings”.
- Web: “Pair device” entry form, handles invalid/expired code gracefully.
- App UI displays device list with last seen time and revoke action.

## Audit & Logging

- Log pairing create/complete/revoke events with userId, deviceId, IP, and userAgent.
- Retain pairing logs for 90 days by default (see SECURITY_AND_PRIVACY_SPEC for retention overrides).

## Notes

- Pairing is a convenience flow and does not replace full account auth when required.
- Tokens may include scope claims (e.g., `read_only` for view-only sessions).
