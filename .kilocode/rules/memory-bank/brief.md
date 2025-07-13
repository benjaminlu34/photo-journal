# Photo Journal - Project Foundation Brief

## Project Foundation

The Photo Journal project was born from the vision of creating a deeply personal yet collaborative digital journaling experience. Inspired by the tactile nature of physical scrapbooks and the creative freedom of bulletin boards, this project addresses the modern need for capturing life's moments in a rich, multimedia format while enabling real-time collaboration with loved ones. The core principle driving this project is the belief that memories are best preserved when they combine multiple forms of expression - text, images, voice, drawings, and checklists - all arranged spatially to tell a story.

## High-Level Overview

Photo Journal is a **CRDT-first real-time collaborative journaling application** that reimagines how we document and share our daily experiences. The architecture consists of:

- **Frontend**: A React 18 application with TypeScript, featuring a glassmorphism UI design powered by Tailwind CSS. The interface provides multiple viewing modes (daily, weekly calendar, weekly creative, and monthly views) with drag-and-drop sticky note functionality.

- **Backend**: Node.js/Express server with PostgreSQL database accessed through Drizzle ORM. Supports both local development with Docker and cloud deployment on Replit with built-in authentication.

- **Real-time Collaboration**: Powered by Yjs (a CRDT library) with WebRTC for peer-to-peer synchronization and IndexedDB for offline persistence. This enables conflict-free collaborative editing where multiple users can work on the same journal entry simultaneously.

- **Authentication**: Dual-mode authentication system supporting Replit OIDC for production and local development authentication for testing.

## Core Requirements and Goals

**Functional Requirements:**
- Multi-user real-time collaboration on journal entries
- Support for diverse content types (text, checklists, images, voice recordings, drawings)
- Offline-first architecture with automatic synchronization
- Social features including friendships and selective entry sharing
- Multiple viewing perspectives (daily, weekly, monthly)
- Spatial arrangement of content blocks with drag-and-drop

**Non-functional Requirements:**
- Sub-100ms latency for local operations
- Conflict-free resolution of concurrent edits
- Data persistence across sessions
- Responsive design for desktop and mobile
- Secure content sharing with granular permissions

**Primary Goals:**
- Create an intuitive, creative space for personal reflection
- Enable meaningful collaboration on shared memories
- Ensure data integrity and privacy
- Provide a delightful user experience with smooth animations

## Key Features

1. **Real-time Collaboration**: Multiple users can edit the same journal entry simultaneously with live cursor tracking and instant updates via WebRTC.

2. **Rich Content Types**: 
   - Text notes with auto-saving
   - Interactive checklists
   - Image uploads with captions
   - Voice recordings with playback
   - Freehand drawing canvas

3. **Flexible Layouts**: Sticky notes can be positioned, resized, and rotated freely on a canvas-like workspace, mimicking a physical bulletin board.

4. **Social Journaling**: Add friends, share specific entries with view/edit permissions, and collaborate on shared memories.

5. **Multiple Views**: Switch between daily focus mode, weekly calendar view, creative weekly spread, and monthly overview.

6. **Offline Support**: Full functionality offline with automatic sync when reconnected, powered by IndexedDB persistence.

## Technologies Used

- **Frontend Framework**: React 18 with TypeScript for type safety and modern component patterns
- **UI Library**: Tailwind CSS with custom glassmorphism theme and Radix UI components
- **State Management**: Zustand for local state, Yjs for distributed state
- **Real-time Sync**: Yjs CRDT with WebRTC provider for peer-to-peer collaboration
- **Database**: PostgreSQL with Drizzle ORM for type-safe queries
- **Authentication**: Passport.js with Replit OIDC and local strategies
- **Development**: Vite for fast builds, Docker for local PostgreSQL
- **Testing**: Vitest for unit tests, pg_prove for database tests

Technology choices prioritize developer experience, performance, and reliability. Yjs was selected for its proven CRDT implementation, while PostgreSQL provides robust data persistence with JSONB support for flexible content storage.

## Significance and Impact

Photo Journal represents a paradigm shift in digital journaling by treating memories as spatial, collaborative artifacts rather than linear text entries. Its innovative use of CRDT technology ensures that multiple family members can contribute to shared memories without conflicts, preserving each person's perspective.

The project's real-world applications include family memory books, travel journals shared among friends, creative project documentation, and personal growth tracking. By combining the intimacy of private journaling with selective sharing capabilities, it bridges the gap between personal reflection and social connection.

The technical innovation lies in applying distributed systems concepts (CRDTs) to a deeply personal use case, demonstrating that advanced computer science can enhance human experiences in meaningful ways.

## Planned Backend Evolution (2025 Q3 Road-map)
Phase	Change set	Rationale & Impact
Sprint 0 – Schema + Snapshot Stub	* Add* yjs_snapshots table (JSONB, append-only, composite index)
* Create* forward+down migration via Drizzle Kit
* Ship* Supabase Edge Function /snapshot/save (returns 202) + Vitest/pg-tap harness	Lays the foundation for conflict-free, versioned board state persisted in Postgres and executed in the same stack that will run production (Supabase).
Sprint 1 – Supabase Auth Integration	* Enable* Supabase Auth (email + Google) & replace Replit Passport flow
* React <SessionContextProvider> for client auth
* New isAuthenticatedSupabase middleware validating JWT with SUPABASE_JWT_SECRET
* RLS policies (auth.uid()) for all user-scoped tables	Unifies local & cloud authentication, removes Replit OIDC dependency, and ties row-level security directly to the authenticated user id.
Sprint 2 – Snapshot Write Path	* Implement* full Edge /snapshot/save (optimistic lock, version bump)
* Client batching ≤1 write/5 s
* Sentry trace + PostHog “Save Snapshot” event	Persists real collaboration data, ensures sub-100 ms local latency, and adds observability around write performance.
Sprint 3 – File Uploads	* Table* files (uuid, board_id, sha256, metadata)
* Edge /upload/sign* – presigned Storage URL, audit row
* MinIO container for local dev	Moves images/voice/drawings off Yjs payloads, lowers snapshot size, adds SHA-256 integrity & MIME guards.
Sprint 4 – Auth & RLS Hardening	* Custom* JWT role claim (`role=admin	user)<br>* Rate-limit table + PG function (is_allowed(ip)`)
* pg-tap tests for RLS, rate-limits
Sprint 5 – Supabase Cloud Cut-over	* IaC* supabase/config.toml + auto migrations in CI
* Deploy* Edge functions via GitHub Actions
* Feature flag USE_SUPABASE toggles cloud vs. local	One-click promotion from local to staging/production; rollback flag safeguards launch.
Sprint 6 – Perf & Security Polish	* Index tuning* via pg_stat_statements, HypoPG
* Cold-start ≤100 ms Edge budget
* Pentest report; DOMPurify + file-type server validation	Meets non-functional goals: <10 ms mean query, secure content handling, and smooth user experience.

Key Outcomes
Single-vendor stack – Postgres + Storage + Auth all on Supabase, but still runnable offline via CLI/Docker.

CRDT snapshots in SQL – append-only JSONB with versioned ordering, ready for analytics.

Edge-native business logic – low-latency Deno functions for snapshot/save & file-signing.

Row-level security first – every query automatically scoped to auth.uid().

Observability baked-in – Sentry traces, PostHog funnels, pg-tap in CI.

These changes complete the transition from prototype to production-grade backend while preserving the offline-first, real-time collaboration ethos of Photo Journal.