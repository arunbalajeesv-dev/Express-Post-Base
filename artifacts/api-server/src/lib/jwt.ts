import jwt from "jsonwebtoken";

export type JwtPayload = {
  id: number;
  userId: string;
  name: string;
  role: string;
};

function getSecret() {
  const secret = process.env["JWT_SECRET"];

  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }

  return secret;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}
