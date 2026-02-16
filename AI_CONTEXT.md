# Project Context — CRM Restaurant (Cloudignite Cost Control)

This is a production-ready restaurant cost control platform, not a demo.

## Goal

Digitize and automate restaurant operations: cost control, inventory, analytics, POS integration, and loss detection.

## Stack

- **Backend:** Node.js, Express
- **Frontend:** Static HTML/CSS/JS (fila folder)
- **Database:** SQLite (with WAL mode, indexes)
- **Auth:** JWT + tenant isolation
- **Deploy:** Docker Compose
- **Integrations:** Square API (optional)

## Architecture

- REST API with Express routes
- Service layer for business logic
- SQLite with migrations
- Feature flags (featureFlags.js)
- In-memory cache for dashboard/analytics

## Non-Negotiable Rules

- Do NOT introduce new frameworks (no React, no NestJS).
- Do NOT change database to PostgreSQL/MySQL without explicit request.
- Respect existing route/service structure.
- All changes must be production-ready.
- No mock logic unless explicitly requested.
- Assume real deployment (Docker, env vars).

## Style

- Explicit error handling.
- Environment-driven config (.env).
- tenant_id on all multi-tenant queries.
- Follow existing patterns in routes and services.

## What This Software Is

An operational restaurant cost control platform with analytics, inventory, and Square sync.

## What It Is NOT

Not a learning project. Not a prototype. Do not redesign architecture.
