import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const g = global as { pj_server?: import("http").Server };
if (g.pj_server?.listening) g.pj_server.close();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Get allowed origins from environment variables or use defaults
const getAllowedOrigins = (): string[] => {
  const origins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
  
  // Always include Supabase URL if available
  if (process.env.SUPABASE_URL) {
    origins.push(process.env.SUPABASE_URL);
  }
  
  // In development, add localhost origins
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:5000');
    origins.push('http://localhost:5173');
    origins.push('http://127.0.0.1:5000');
    origins.push('http://127.0.0.1:5173');
  }
  
  return origins;
};

// CORS options with stricter configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check against allowed origins
    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, be more permissive but still log
      log(`CORS: ${origin} requested access`);
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
};

// Apply CORS middleware to API routes
app.use('/api', cors(corsOptions));

// Block all CORS for uploads in production (must be accessed via same origin)
if (process.env.NODE_ENV === 'production') {
  app.use('/uploads', (req, res, next) => {
    // Check if the request is from the same origin
    const origin = req.headers.origin;
    const host = req.headers.host;
    
    if (origin && host && !origin.includes(host)) {
      return res.status(403).json({ message: 'Cross-origin access to uploads is not allowed' });
    }
    
    next();
  });
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Handle legacy auth redirects - only for specific legacy endpoints
  app.get('/api/login', (req, res) => {
    log(`[Legacy Redirect] Redirecting ${req.originalUrl} to /`);
    res.redirect('/');
  });

  app.get('/api/logout', (req, res) => {
    log(`[Legacy Redirect] Redirecting ${req.originalUrl} to /`);
    res.redirect('/');
  });

  app.get('/login', (req, res) => {
    res.redirect('/');
  });

  app.get('/signup', (req, res) => {
    res.redirect('/');
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.

  const port = process.env.PORT ? Number(process.env.PORT) : 5000;
  server.listen(port, "0.0.0.0", () => {
    log(`🚀 API listening on :${port}`);
  });
})();
