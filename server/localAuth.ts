import type { Request, Response, NextFunction } from "express";

export function localAuth(req: Request, _res: Response, next: NextFunction) {
  (req as any).user = {
    id: req.header("x-dev-user") ?? "dev-user",
    role: "owner",
  };
  next();
}
