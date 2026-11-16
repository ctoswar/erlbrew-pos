# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-11-17

Current development version. Highlights from the recent release cycle:

### Added
- Loyalty program: missions, rewards with Flutter/SVG icon sets, and custom point scanning
- Customer PII encryption at rest
- Google Sign-In with automatic account provisioning
- Email marketing and notification settings
- "Keep me signed in" sessions and legal username capture at signup
- Minimum 8-character password policy

### Fixed
- Icon font cache-busting (stale immutable copies rendered blank glyphs)
- Double `/api` prefix in email marketing endpoints
- POS order username linking and order-history name rendering
- Company settings returning 401 on authenticated fetches
- Dependency advisories: `glob` / `minimatch` in the server

### Infrastructure
- GitLab CI pipeline: type-check, server tests, frontend production build, gitleaks secret scanning
- Protected `main` with merge-request gating on self-hosted GitLab; mirrored to GitHub via pull requests

[2.0.0]: https://github.com/ctoswar/erlbrew-pos/releases
