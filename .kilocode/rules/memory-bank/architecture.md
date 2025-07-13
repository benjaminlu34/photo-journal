# Photo Journal - Architecture & Technical Design

## System Architecture Overview

Photo Journal follows a modern client-server architecture with real-time collaboration capabilities:

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   UI Layer  │  │ State Mgmt   │  │  CRDT Layer      │   │
│  │  (Radix UI) │  │  (Zustand)   │  │  (Yjs/WebRTC)   │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├── HTTP/WebSocket
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Node.js)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   Express   │  │    Auth      │  │   Storage        │   │
│  │   Routes    │  │  (Passport)  │  │  (Drizzle ORM)  │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├── SQL
                              │
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │    Users    │  │   Journal    │  │  Yjs Snapshots   │   │
│  │  Sessions   │  │   Entries    │  │   (Future)       │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Source Code Structure

### Frontend (`/client/src/`)
- **`/components/`** - React components organized by feature
  - `/board/` - Sticky board and note management components
  - `/journal/` - Journal views (daily, weekly, monthly)
  - `/noteShell/` - Note container with drag/resize capabilities
  - `/noteTypes/` - Individual note type components (text, image, etc.)
  - `/ui/` - Radix UI component library
- **`/contexts/`** - React contexts for global state
  - `crdt-context.tsx` - CRDT/Yjs provider
  - `journal-context.tsx` - Journal state management
  - `dnd-context.tsx` - Drag and drop context
- **`/hooks/`** - Custom React hooks
- **`/lib/`** - Core business logic
  - `board-sdk.ts` - Yjs CRDT operations wrapper
  - `board-store.ts` - Zustand store for board state
- **`/pages/`** - Top-level route components
- **`/types/`** - TypeScript type definitions

### Backend (`/server/`)
- **`index.ts`** - Express server entry point
- **`routes.ts`** - API route definitions
- **`storage.ts`** - Database operations layer
- **`db.ts`** - Database connection setup
- **`localAuth.ts`** - Local development authentication
- **`replitAuth.ts`** - Replit OIDC authentication
- **`vite.ts`** - Vite dev server integration

### Shared (`/shared/`)
- **`schema.ts`** - Drizzle ORM schema definitions shared between frontend and backend

## Key Technical Decisions

### 1. CRDT-First Architecture
- **Yjs** for conflict-free collaborative editing
- **WebRTC** for peer-to-peer synchronization
- **IndexedDB** for offline persistence
- Enables real-time collaboration without central coordination

### 2. Database Design
- **PostgreSQL** with JSONB for flexible content storage
- **Drizzle ORM** for type-safe database queries
- **Append-only snapshots** (planned) for CRDT persistence
- Composite indexes for performance optimization

### 3. Authentication Strategy
- **Dual-mode authentication** supporting both development and production
- **Passport.js** with pluggable strategies
- **Session-based auth** with PostgreSQL session store
- Seamless switching between local and Replit OIDC

### 4. UI/UX Architecture
- **Glassmorphism design** with Tailwind CSS
- **Radix UI** for accessible, unstyled components
- **Framer Motion** for smooth animations
- **React DnD** for drag-and-drop interactions

## Design Patterns

### 1. Repository Pattern
- `storage.ts` abstracts all database operations
- Clean separation between business logic and data access
- Easy to mock for testing

### 2. Provider Pattern
- React contexts wrap components needing shared state
- CRDT provider manages Yjs document lifecycle
- Authentication provider handles user state

### 3. Component Composition
- Note types are pluggable via registry pattern
- Shell components handle common functionality
- Content components focus on specific note types

### 4. Singleton Pattern
- Board SDK instances are cached per space
- Prevents duplicate Yjs documents
- Ensures consistent state across components

## Critical Implementation Paths

### 1. Real-time Collaboration Flow
```
User Action → Board Store → Yjs Document → WebRTC Provider → Remote Peers
                    ↓                             ↓
                Local UI ← Board Store ← Yjs Document
```

### 2. Authentication Flow
```
Request → Express Middleware → Passport Strategy → Database
              ↓                      ↓
         Session Store          User Object → Response
```

### 3. Note Creation Flow
```
UI Click → Board Store Action → SDK Create → Yjs Map Set
                ↓                               ↓
          Local State Update            Remote Broadcast
```

## Performance Considerations

- **Optimistic UI updates** via local-first CRDT operations
- **Lazy loading** of journal entries and content blocks
- **Memoization** of expensive React renders
- **Indexed database queries** for fast lookups
- **WebRTC connection pooling** for efficient peer connections

## Security Architecture

- **Row-level security** planned for Supabase migration
- **CORS configuration** for API endpoints
- **Session security** with secure cookies
- **Input sanitization** with DOMPurify
- **File upload validation** (planned)