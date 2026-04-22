import type { ErrorRequestHandler } from "express";

function getCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  return null;
}

function getStatusCode(error: unknown): number | null {
  if (typeof error === "object" && error !== null && "statusCode" in error) {
    const s = (error as { statusCode: unknown }).statusCode;
    return typeof s === "number" ? s : null;
  }
  return null;
}

function getMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  return null;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (typeof error === "object" && error !== null && "name" in error && error.name === "ZodError") {
    res.status(400).json({ message: "Validation failed", details: error });
    return;
  }

  const customStatus = getStatusCode(error);
  if (customStatus) {
    res.status(customStatus).json({ message: getMessage(error) ?? "Request failed" });
    return;
  }

  if (getCode(error) === "23505") {
    res.status(409).json({ message: "A record with that unique value already exists" });
    return;
  }

  req.log.error({ err: error }, "Unhandled request error");
  res.status(500).json({ message: "Internal server error" });
};
