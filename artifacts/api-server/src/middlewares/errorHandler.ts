import type { ErrorRequestHandler } from "express";

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code: unknown }).code);
  }

  return null;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (typeof error === "object" && error !== null && "name" in error && error.name === "ZodError") {
    res.status(400).json({ error: "Validation failed", details: error });
    return;
  }

  if (getErrorCode(error) === "23505") {
    res.status(409).json({ error: "A record with that unique value already exists" });
    return;
  }

  req.log.error({ err: error }, "Unhandled request error");
  res.status(500).json({ error: "Internal server error" });
};