import type { RequestHandler } from "express";

export const requireAgent: RequestHandler = (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  if (req.user.role.toLowerCase() === "manager") {
    res.status(403).json({ message: "Managers have read-only access. Only sales agents can perform this action." });
    return;
  }

  next();
};
