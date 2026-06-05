# Vibehall Frontend

## Purpose
This directory is the frontend application base for Vibehall.

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

## Contract Inputs
Frontend implementation must follow:
- `../Roads/project-foundation/02-system-definition/rest-contract-v1.md`
- `../Roads/project-foundation/02-system-definition/websocket-contract-v1.md`
- `../Roads/project-foundation/02-system-definition/shared-contract-v1.md`

## Current Wave Status
Wave 3 adds auth state, login/signup UI, session lookup, logout, protected room-entry gate behavior, and post-auth return intent handling.

Room creation, real discover data, and room entry implementation begin in later waves.
