import type { RequestHandler } from "express";
import { z } from "zod/v4";
import { insertUserSchema } from "@workspace/db";
import * as userModel from "../models/userModel";
import { signToken } from "../lib/jwt";

const loginSchema = z.object({
  user_id: z.string().min(1, "user_id is required"),
  password: z.string().min(1, "password is required"),
});

export const login: RequestHandler = async (req, res) => {
  const { user_id, password } = loginSchema.parse(req.body);

  let user;
  try {
    user = await userModel.findByUserId(user_id);
  } catch (err) {
    res.status(500).json({ message: "DB error", detail: String(err) });
    return;
  }

  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const valid = await userModel.verifyPassword(password, user.password);

  if (!valid) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const token = signToken({
    id: user.id,
    userId: user.userId,
    name: user.name,
    role: user.role,
  });

  res.json({
    message: "Login successful",
    token,
    user: {
      id: user.id,
      name: user.name,
      userId: user.userId,
      role: user.role,
      mobile: user.mobile,
    },
  });
};

export const createUser: RequestHandler = async (req, res) => {
  const payload = insertUserSchema.parse(req.body);
  const existing = await userModel.findByUserId(payload.userId);

  if (existing) {
    res.status(409).json({ message: "A user with that user_id already exists" });
    return;
  }

  const user = await userModel.createUser(payload);

  res.status(201).json({
    message: "User created",
    data: {
      id: user!.id,
      name: user!.name,
      userId: user!.userId,
      role: user!.role,
      mobile: user!.mobile,
    },
  });
};
