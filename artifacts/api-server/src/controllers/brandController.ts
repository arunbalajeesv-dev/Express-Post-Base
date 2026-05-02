import type { RequestHandler } from "express";
import { insertBrandSchema } from "@workspace/db";
import * as brandModel from "../models/brandModel";

export const listBrands: RequestHandler = async (_req, res) => {
  const brands = await brandModel.listBrands();
  res.json({ data: brands });
};

export const createBrand: RequestHandler = async (req, res) => {
  const payload = insertBrandSchema.parse(req.body);
  const existingBrand = await brandModel.findBrandByNameInsensitive(payload.name);

  if (existingBrand) {
    res.status(409).json({ message: "Brand already exists", data: existingBrand });
    return;
  }

  const brand = await brandModel.createBrand({ name: payload.name.trim() });
  res.status(201).json({ message: "Brand created", data: brand });
};
