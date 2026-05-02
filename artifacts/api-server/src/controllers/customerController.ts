import type { RequestHandler } from "express";
import { z } from "zod/v4";
import * as customerModel from "../models/customerModel";
import { db, visitsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

export const listCustomers: RequestHandler = async (req, res) => {
  const customers = await customerModel.listCustomersWithStats();
  res.json({ data: customers });
};

export const getCustomer: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid customer id" }); return; }

  const detail = await customerModel.getCustomerDetail(id);
  if (!detail) { res.status(404).json({ message: "Customer not found" }); return; }

  res.json({ data: detail });
};

const updateCustomerSchema = z.object({
  name:        z.string().trim().min(1, "Name is required").optional(),
  companyName: z.string().trim().optional().nullable(),
});

export const updateCustomer: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid customer id" }); return; }

  const payload = updateCustomerSchema.parse(req.body);
  const customer = await customerModel.updateCustomer(id, payload);
  if (!customer) { res.status(404).json({ message: "Customer not found" }); return; }

  res.json({ message: "Customer updated", data: customer });
};

const SITE_STAGE_VALUES = [
  "New Site/ Foundation",
  "Brickwork",
  "Plastering",
  "Roofing",
  "Painting/ Tiles",
  "Plumbing/ Electrical",
  "Finishing Stage",
] as const;

const updateVisitSchema = z.object({
  site_stage: z.enum(SITE_STAGE_VALUES, {
    error: `Site stage must be one of: ${SITE_STAGE_VALUES.join(", ")}`,
  }),
});

export const updateVisit: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ message: "Invalid visit id" }); return; }

  const payload = updateVisitSchema.parse(req.body);

  const [visit] = await db
    .update(visitsTable)
    .set({ siteStage: payload.site_stage })
    .where(eq(visitsTable.id, id))
    .returning();

  if (!visit) { res.status(404).json({ message: "Visit not found" }); return; }

  res.json({ message: "Visit updated", data: visit });
};
