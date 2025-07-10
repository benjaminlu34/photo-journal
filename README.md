# FlowJournal - Social Journaling Platform

## Overview

FlowJournal is a social journaling application designed for college-age friends to share memories, coordinate plans, and stay emotionally connected. The application allows users to create interactive journal entries with various content types (sticky notes, photos, text, checklists, audio, drawings) and share them with friends in a collaborative environment.

## Current Development Status

### Completed Features (✅)
- **Note Shell System**
  - `noteRegistry.ts` with placeholder bodies for text/checklist/image/voice/drawing
  - `noteContext.tsx` exposing selectedId, CRUD operations, and gridSnap
  - `snapToGrid.ts` implementation (20px grid)
  - `StickyBoard.tsx` with new note rendering, dotted grid, and Grid-snap toggle
  - Integration with workspace.tsx (dual rendering with legacy blocks)

### In Progress Features (🚧)
- **Grid-snap System**
  - Toggle behavior implementation
  - Position snapping to 20px increments
  - State persistence
- **Legacy to Shell Migration**
  - Dual-render parity verification
  - Drag path optimization
  - Write-back system for legacy compatibility

### Upcoming Features (📋)
- State persistence for user preferences
- Enhanced drag-and-drop system
- Complete migration from legacy content blocks
- Improved visual consistency between systems

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: React Context API with custom providers
- **UI Framework**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom neumorphic design system
- **Drag & Drop**: 
  - Legacy: react-dnd for content blocks
  - New: Custom implementation with pointer events
- **Data Fetching**: TanStack Query (React Query) for server state management

### Backend Architecture
- **Runtime**: Node.js with Express server
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Authentication**: Replit Auth (OIDC-based) with Passport.js
- **Session Management**: express-session with PostgreSQL store
- **API Design**: RESTful endpoints with type-safe validation using Zod

### Build System
- **Frontend Bundler**: Vite with React plugin
- **Backend Bundler**: esbuild for production builds
- **Development**: Hot module replacement and file watching
- **TypeScript**: Shared type definitions between client and server

## Key Components

### Authentication System
- Uses Replit's OIDC authentication provider
- Session-based authentication with secure cookies
- Mandatory user and session tables for Replit Auth compatibility
- Automatic user creation and profile management

### Journal Entry System
- Date-based journal entries with flexible content blocks
- Multiple view modes: daily, weekly-calendar, weekly-creative, monthly
- Real-time content block creation, editing, and positioning
- Drag-and-drop interface for intuitive content management

### Content Block Types
- **Sticky Notes**: Quick text notes with neumorphic styling
- **Photos**: Image uploads with captions
- **Text**: Rich text content blocks
- **Checklists**: Interactive todo items
- **Audio**: Voice recordings and audio content
- **Drawings**: Canvas-based drawing functionality

### Social Features
- Friend connections and friendship management
- Entry sharing between users
- Collaboration panel for coordinating activities
- Real-time updates through optimistic UI patterns

### Design System
- Custom neumorphic design with soft shadows and gradients
- Primary color palette based on purple/lavender tones
- Responsive design with mobile-first approach
- Consistent spacing and typography using Tailwind utilities

### Note Shell System (New)
- **Registry**: Central type system for all note variants
- **Context**: Shared state and CRUD operations
- **Grid System**: 20px snap-to-grid with toggle
- **Shell Component**: Universal wrapper for all note types
- **Mapping Layer**: Bidirectional conversion with legacy blocks

## Data Flow

### Client-Side Data Flow
1. User authentication check on app initialization
2. Journal context provides centralized state management
3. TanStack Query handles server state caching and synchronization
4. Optimistic updates for immediate UI feedback
5. Error boundaries and toast notifications for user feedback

### Server-Side Data Flow
1. Request authentication middleware validates sessions
2. Route handlers parse and validate request data with Zod schemas
3. Storage layer abstracts database operations through Drizzle ORM
4. Database transactions ensure data consistency
5. Response serialization with type safety

### Database Schema
- **Users**: Replit Auth required table with profile information
- **Sessions**: Replit Auth required table for session storage
- **Journal Entries**: Date-based entries with metadata
- **Content Blocks**: Polymorphic content with position data
- **Friendships**: User relationships with status tracking
- **Shared Entries**: Entry sharing permissions and access control

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **react-dnd**: Drag and drop functionality
- **@radix-ui/***: Accessible UI primitives

### Authentication Dependencies
- **openid-client**: OIDC authentication handling
- **passport**: Authentication middleware
- **connect-pg-simple**: PostgreSQL session store

### Development Dependencies
- **vite**: Fast build tool and dev server
- **typescript**: Type checking and compilation
- **tailwindcss**: Utility-first CSS framework
- **@replit/vite-plugin-***: Replit-specific development tools

## Deployment Strategy

### Development Environment
- Local development uses Vite dev server with HMR
- Replit integration with authentication and database provisioning
- Environment variables for database connection and session secrets

### Production Build
- Frontend: Vite builds optimized React bundle to `dist/public`
- Backend: esbuild compiles TypeScript server to `dist/index.js`
- Static asset serving through Express in production mode

### Database Management
- Drizzle migrations in `/migrations` directory
- Schema definitions in `/shared/schema.ts`
- Database push command for development schema updates

### Environment Configuration
- `DATABASE_URL`: PostgreSQL connection string (required)
- `SESSION_SECRET`: Secure session encryption key (required)
- `REPL_ID`: Replit environment identifier
- `ISSUER_URL`: OIDC provider URL for authentication

### Recent Changes (July 2025)
- **Note Shell System**: Introduced new architecture for improved performance and maintainability
- **Grid System**: Added snap-to-grid functionality with visual overlay
- **Dual Rendering**: Support for both legacy and new note systems
- **Visual Consistency**: Enhanced neumorphic design system
- **Performance**: Optimized drag operations with pointer events
- **Type Safety**: Improved TypeScript coverage and mapping systems

### Scalability Considerations
- Stateless server design enables horizontal scaling
- PostgreSQL connection pooling for database efficiency
- CDN-ready static asset structure
- Session store can be migrated to Redis for distributed systems

## Migration Guide

### Legacy to Shell Migration
1. **Dual Rendering Phase**
   - Both systems operate simultaneously
   - Content syncs bidirectionally
   - Visual parity maintained

2. **Gradual Feature Migration**
   - Grid snap system
   - Enhanced drag operations
   - Improved type safety
   - Better performance characteristics

3. **Final Migration**
   - Complete transition to shell system
   - Legacy system deprecation
   - Data migration utilities

## Development Workflow

### Current Focus
1. Stabilize grid snap system
2. Ensure visual and state parity
3. Optimize drag operations
4. Complete mapping layer
5. Implement persistence

### Testing Priorities
- Grid snap toggle behavior
- Drag operation consistency
- State synchronization
- Visual rendering parity
- Performance metrics