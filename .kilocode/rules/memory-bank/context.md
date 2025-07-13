# Photo Journal - Current Context

## Current Work Focus

The Photo Journal project is a fully functional CRDT-based collaborative journaling application. The core architecture is complete with:

- **Frontend**: React 18 + TypeScript application with glassmorphism UI
- **Backend**: Node.js/Express server with PostgreSQL database
- **Real-time Sync**: Yjs CRDT implementation with WebRTC for peer-to-peer collaboration
- **Authentication**: Dual-mode system supporting both Replit OIDC and local development auth

## Recent Changes

Based on the codebase analysis:
- Implemented sticky note board functionality with drag-and-drop capabilities
- Added support for 5 note types: text, checklist, image, voice, and drawing
- Integrated Yjs for conflict-free real-time collaboration
- Set up WebRTC provider for peer-to-peer synchronization
- Added IndexedDB persistence for offline support
- Created multiple view modes: daily, weekly calendar, weekly creative, and monthly

## Next Steps

According to the planned backend evolution (Q3 2025 roadmap):

1. **Sprint 0**: Add yjs_snapshots table and Supabase Edge Function for snapshot saving
2. **Sprint 1**: Integrate Supabase Auth to replace Replit Passport flow
3. **Sprint 2**: Implement full snapshot write path with batching
4. **Sprint 3**: Add file upload support with presigned Storage URLs
5. **Sprint 4**: Harden authentication and implement rate limiting
6. **Sprint 5**: Deploy to Supabase cloud with feature flags
7. **Sprint 6**: Performance optimization and security hardening

Planned layout includes:

Daily view with sticky notes, weekly calendar view, creative weekly spread, and monthly overview. The focus is on enhancing the collaborative experience while maintaining offline functionality.

Dual weekly view:

Calendar view integration with google calendar and apple calendar for event synchronization.

Creative weekly view with spatial arrangement of notes, images, and drawings, synced with daily board entries.

Monthly view:

Displays calendar, with random photo selected from daily board if available, and allows for quick navigation to daily entries.
## Current State

- **Development Mode**: Local development with Docker PostgreSQL
- **Authentication**: Working with both Replit and local auth strategies
- **Database**: PostgreSQL with Drizzle ORM, schema includes users, journal entries, content blocks, friendships, and shared entries
- **Real-time**: Yjs CRDT working with WebRTC signaling through yjs.dev servers
- **UI**: Glassmorphism theme implemented with Tailwind CSS and Radix UI components