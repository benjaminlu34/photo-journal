# Photo Journal - Technology Stack & Development Setup

## Core Technologies

### Frontend Stack
- **React 18.3.1** - Modern UI library with concurrent features
- **TypeScript 5.6.3** - Type safety and better developer experience
- **Vite 5.4.19** - Lightning-fast build tool and dev server
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Radix UI** - Unstyled, accessible component primitives
- **Zustand 5.0.6** - Lightweight state management
- **Yjs 13.6.27** - CRDT library for real-time collaboration
- **y-webrtc 10.3.0** - WebRTC provider for Yjs
- **y-indexeddb 9.0.12** - IndexedDB persistence for Yjs
- **React Query 5.60.5** - Server state management
- **Wouter 3.3.5** - Minimalist routing library
- **React DnD 16.0.1** - Drag and drop interactions
- **Framer Motion 11.13.1** - Animation library
- **Lucide React** - Icon library

### Backend Stack
- **Node.js >= 20.11** - JavaScript runtime
- **Express 4.21.2** - Web application framework
- **PostgreSQL 16** - Primary database
- **Drizzle ORM 0.39.1** - Type-safe SQL query builder
- **Passport.js 0.7.0** - Authentication middleware
- **Express Session 1.18.1** - Session management
- **Zod 3.25.76** - Schema validation
- **DOMPurify 3.2.6** - XSS sanitization

### Development Tools
- **pnpm** - Fast, disk space efficient package manager
- **Docker** - Containerization for PostgreSQL
- **Nodemon** - Auto-restart on file changes
- **tsx 4.19.1** - TypeScript execution for Node.js
- **Vitest 1.6.1** - Unit testing framework
- **pg_prove** - PostgreSQL testing framework
- **Drizzle Kit 0.30.4** - Database migrations

## Development Setup

### Prerequisites
```bash
# Required software
- Node.js >= 20.11
- Docker Desktop
- pnpm (npm install -g pnpm)
```

### Environment Configuration
```bash
# .env file structure
DATABASE_URL=postgres://postgres:postgres@localhost:5432/photo_journal
SESSION_SECRET=your-secret-key-minimum-32-characters
NODE_ENV=development
REPLIT=false  # Set to true for Replit deployment
```

### Local Development Commands
```bash
# Install dependencies
pnpm install

# Initialize database (starts Docker PostgreSQL + runs migrations)
pnpm run db:init

# Start development server
pnpm dev  # Runs on http://localhost:5000

# Run tests
pnpm test        # Unit tests
pnpm test:watch  # Watch mode
pnpm test:pg     # PostgreSQL tests

# Type checking
pnpm check

# Build for production
pnpm build
```

### Replit Development
```bash
# Use Replit-specific mode
pnpm run dev:replit

# Automatically uses:
- Replit's PostgreSQL database
- Replit OIDC authentication
- Replit-specific Vite plugins
```

## Technical Constraints

### Performance Requirements
- **Local operation latency**: < 100ms
- **Initial page load**: < 3 seconds
- **WebRTC connection**: < 2 seconds
- **Database queries**: < 50ms average

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

### Security Constraints
- **Session security**: HTTP-only, secure cookies
- **CORS**: Configured for API endpoints
- **Input sanitization**: All user content through DOMPurify
- **Authentication**: Mandatory for all journal operations

## Dependencies Overview

### Key Production Dependencies
- **Yjs ecosystem**: Core CRDT functionality
- **Radix UI components**: Full component library for UI
- **React Hook Form**: Form handling with validation
- **date-fns**: Date manipulation utilities
- **nanoid**: Unique ID generation
- **ws**: WebSocket support for real-time features

### Development Dependencies
- **Vite ecosystem**: Build tooling and plugins
- **TypeScript tooling**: Type definitions and utilities
- **Testing utilities**: Vitest and related tools
- **Replit plugins**: Platform-specific integrations

## Tool Usage Patterns

### Database Operations
- Use Drizzle ORM for all database queries
- Migrations via `drizzle-kit push`
- Type-safe schemas shared between frontend/backend

### State Management
- Zustand for local UI state
- Yjs for distributed/collaborative state
- React Query for server state

### Authentication Flow
- Passport.js with strategy pattern
- Local strategy for development
- Replit OIDC for production
- Session stored in PostgreSQL

### Real-time Collaboration
- Yjs documents per journal entry
- WebRTC for peer connections
- IndexedDB for offline persistence
- Automatic conflict resolution via CRDTs