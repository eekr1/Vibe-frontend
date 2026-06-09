# Vibehall Frontend

## Purpose
This directory is the frontend application base for Vibehall.

This directory is also the standalone frontend Git repository. The parent `Vibehall/`
folder is a local workspace only and is not required for frontend build or deploy.

Planned stack:
- React
- Vite
- TypeScript

## Responsibilities
The frontend owns:
- page routing and app shell
- user-facing auth, discover, create room, room, profile, safety, and admin surfaces
- API client integration
- Socket.IO client integration
- loading, empty, error, denied, full, banned, and ended room states
- responsive UI behavior

## Repository Boundary
This repo should stay self-contained for GitHub, Render, and local frontend work.

Use this repo's own scripts for build and deploy:
- `npm.cmd run dev`
- `npm.cmd run build`
- `npm.cmd run typecheck`

Canonical product and roadmap documents may exist one folder above in the local
workspace at `../Roads/project-foundation/`, but they are not part of this Git
repository and should not be required by CI or deployment.

## Current Wave Status
Wave 9 adds the admin console with overview, users, rooms, reports, moderation history, categories management, admin access feedback, and debug visibility.

The first full build wave sequence is complete. Release readiness now depends on deploy environment configuration and manual regression verification.
