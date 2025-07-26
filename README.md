# Photo Journal

A real-time collaborative journaling application built with React, TypeScript, and Yjs. Create multimedia journal entries with text, images, voice recordings, and drawings that sync instantly across devices and users.

Created for my girlfriend as a fun side project inspired by some pinterest designs :)

## Features

- **Real-time collaboration** - Multiple users can edit the same journal entry simultaneously
- **Offline-first** - Full functionality without internet connection, automatic sync when reconnected
- **Rich content types** - Text notes, checklists, images, voice recordings, and freehand drawings
- **Flexible layouts** - Drag-and-drop positioning with multiple view modes (daily, weekly, monthly)
- **User management** - Username system with search, profiles, and social features
- **Responsive design** - Works on desktop, tablet, and mobile devices

## Tech Stack

**Frontend**
- React with TypeScript
- Tailwind CSS
- Radix UI components
- Yjs
- WebRTC 
- IndexedDB

**Backend**
- Node.js with Express
- PostgreSQL with Drizzle ORM
- Supabase Auth for authentication
- JWT-based session management

**Development**
- Vite/Vitest
- Docker for local dev environment (for testing)

## Getting Started

### Prerequisites

- Node.js 20.11 or higher
- Docker (for local PostgreSQL)
- pnpm (switched from npm for this project, like it a lot)

### Installation

1. Clone the repository and install dependencies:
```bash
git clone <repository-url>
cd photo-journal
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env

for my environment I have a supabase env and local env for their respective urls. This is optional
```

3. Start the database and run migrations:
```bash
pnpm run db:init
```

4. Start the development server:
```bash
pnpm dev
```

The application will be available at `http://localhost:5000`

## Development

### Environment Configurations

The project supports multiple environment configurations:

- **Local development** (`pnpm dev`) - use if you just have one db url
- **Local with Supabase** (`pnpm dev:local`), (`pnpm dev:supabase`)  - my setup, one for local and one for supabase url
### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with default environment |
| `pnpm dev:local` | Start with local database and Supabase auth |
| `pnpm dev:supabase` | Start with Supabase cloud database |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm test` | Run test suite |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm check` | Type checking |
| `pnpm db:studio` | Open Drizzle Studio for database management |

### Database Management

```bash
# Push schema changes to local database
pnpm db:push:local

# Push schema changes to Supabase
pnpm db:push:supabase

```

## Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=your db url
SESSION_SECRET=your-secret-key-minimum-32-characters
NODE_ENV=development

# Supabase env variables
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Architecture

### CRDT-First Design

The application uses Conflict-free Replicated Data Types (CRDTs) via Yjs to enable real-time collaboration without conflicts. This was how I decided to implement the feature that allows multiple users to edit the same online "pinboard" simultaneously while maintaining consistency.

### Project Structure

```
├── client/src/          
├── server/             
├── shared/              
├── migrations/         
├── tests/               
├── scripts/            
└── supabase/            
```

## Testing

The project includes pretty comprehensive testing:

- **Unit tests** - Component and function testing with Vitest
- **Integration tests** - API endpoint and database testing
- **PostgreSQL tests** - Database constraint and migration testing with pg_prove

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run PostgreSQL-specific tests
pnpm test:pg
```

## Deployment

### Production Build

```bash
pnpm build
pnpm start
```

### Environment Setup

1. Set up a PostgreSQL database
2. Configure Supabase project for authentication
3. Set production environment variables
4. Run database migrations
5. Deploy the built application

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. (If not made yet sorry lazy)