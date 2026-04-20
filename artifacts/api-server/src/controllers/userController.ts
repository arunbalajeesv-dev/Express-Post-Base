import type { RequestHandler } from "express";
import { insertUserSchema, updateUserSchema } from "@workspace/db";
import * as userModel from "../models/userModel";

function parseId(value: string | undefined) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const listUsers: RequestHandler = async (_req, res) => {
  const users = await userModel.listUsers();
  res.json({ data: users });
};

export const getUser: RequestHandler = async (req, res) => {
  const id = parseId(req.params["id"]);

  if (!id) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const user = await userModel.getUserById(id);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ data: user });
};

export const createUser: RequestHandler = async (req, res) => {
  const payload = insertUserSchema.parse(req.body);
  const user = await userModel.createUser(payload);
  res.status(201).json({ data: user });
};

export const updateUser: RequestHandler = async (req, res) => {
  const id = parseId(req.params["id"]);

  if (!id) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const payload = updateUserSchema.parse(req.body);
  const user = await userModel.updateUser(id, payload);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ data: user });
};

export const deleteUser: RequestHandler = async (req, res) => {
  const id = parseId(req.params["id"]);

  if (!id) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const user = await userModel.deleteUser(id);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ data: user });
};