# Photo Journal - CRDT-First Real-Time Collaboration

A modern, real-time collaborative photo journal application built with React, TypeScript, and Yjs for seamless multi-user editing experiences.

## 🚀 Local Development

### Prerequisites
- Node.js >= 20.11
- Docker (for local PostgreSQL)
- pnpm (recommended package manager)

### Quick Start

```bash
# 1. Clone and install dependencies
pnpm install

# 2. Copy environment variables
cp .env.example .env

# 3. Start PostgreSQL and run migrations
pnpm run db:init

# 4. Start development server
pnpm dev
```

The application will be available at `http://localhost:5000`

### Development Modes

#### Local Development (Docker)
```bash
pnpm dev
```
- Uses local PostgreSQL via Docker
- Local authentication with dev-user
- Hot reload for both frontend and backend

#### Replit Development
```bash
pnpm run dev:replit
```
- Uses Replit's built-in PostgreSQL
- Replit OIDC authentication
- Replit-specific plugins and features

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/photo_journal` |
| `SESSION_SECRET` | Session encryption key | `replace-me` (must be ≥32 chars) |
| `NODE_ENV` | Environment mode | `development` |
| `REPLIT` | Enable Replit mode | `false` |

### Database Setup

#### Local Development
```bash
# Start PostgreSQL container
docker compose up -d db

# Run migrations
pnpm drizzle-kit push
```

#### Replit
No additional setup needed - uses Replit's managed PostgreSQL.

### Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start local development server |
| `pnpm run dev:replit` | Start Replit development server |
| `pnpm run db:init` | Initialize database (Docker + migrations) |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm check` | Type checking |

### Architecture Overview

The application uses a **CRDT-first architecture** powered by Yjs for real-time collaboration:

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + PostgreSQL
- **Real-time**: Yjs + WebRTC for peer-to-peer sync
- **Authentication**: Replit OIDC (production) / Local dev auth (development)
- **Database**: PostgreSQL via Drizzle ORM

### Key Features

- **Real-time collaboration** with conflict-free editing
- **Offline-first** with automatic sync
- **Multiple note types**: Text, checklist, image, voice, drawing
- **Social features**: Friendships and entry sharing
- **Multiple views**: Daily, weekly, monthly layouts
- **Responsive design** with glassmorphism UI

### Development Workflow

1. **Feature Development**: Use local development mode
2. **Testing**: Run `pnpm check` for type checking
3. **Database Changes**: Use `pnpm drizzle-kit push` for migrations
4. **Production**: Deploy to Replit or your preferred platform

### Troubleshooting

#### Port 5000 already in use
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9
```

#### Database connection issues
```bash
# Check if PostgreSQL is running
docker ps
# Restart PostgreSQL
docker compose restart db
```

#### Permission issues on Windows
```bash
# Run as administrator or use WSL
# Ensure Docker Desktop is running
```

### Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Test with both local and Replit modes
4. Submit a pull request

### License

MIT License - see LICENSE file for details
