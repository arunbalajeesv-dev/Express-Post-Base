import type { RequestHandler } from "express";

export const requireManager: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (req.user.role.toLowerCase() !== "manager") {
    res.status(403).json({ message: "Manager access required" });
    return;
  }

  next();
};
