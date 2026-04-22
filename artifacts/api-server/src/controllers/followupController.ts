import type { RequestHandler } from "express";
import { z } from "zod/v4";
import * as followupModel from "../models/followupModel";

const addFollowupSchema = z.object({
  visit_id: z.number().int().positive("visit_id must be a positive integer"),
  followup_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "followup_date must be in YYYY-MM-DD format")
    .refine(
      (date) => date >= new Date().toISOString().slice(0, 10),
      "followup_date cannot be in the past",
    ),
  notes: z.string().trim().optional(),
});

const updateFollowupSchema = z
  .object({
    status: z.enum(["Pending", "Completed", "Converted"], {
      error: "status must be Pending, Completed, or Converted",
    }),
    sale_amount: z.string().trim().optional(),
    invoice_number: z.string().trim().optional(),
    followup_date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "followup_date must be in YYYY-MM-DD format")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "Converted") {
      if (!data.sale_amount || data.sale_amount.trim() === "") {
        ctx.addIssue({
          code: "custom",
          path: ["sale_amount"],
          message: "Sale amount and invoice number are required for conversion",
        });
      } else if (isNaN(Number(data.sale_amount)) || Number(data.sale_amount) <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["sale_amount"],
          message: "sale_amount must be a positive number",
        });
      }
      if (!data.invoice_number || data.invoice_number.trim() === "") {
        ctx.addIssue({
          code: "custom",
          path: ["invoice_number"],
          message: "Sale amount and invoice number are required for conversion",
        });
      }
    }
  });

export const addFollowup: RequestHandler = async (req, res) => {
  const payload = addFollowupSchema.parse(req.body);

  const visit = await followupModel.findVisitById(payload.visit_id);
  if (!visit) {
    res.status(404).json({ message: `Visit with id ${payload.visit_id} not found` });
    return;
  }

  const followup = await followupModel.addFollowup({
    visitId: payload.visit_id,
    followupDate: payload.followup_date,
    notes: payload.notes,
  });

  res.status(201).json({
    message: "Follow-up scheduled successfully",
    data: followup,
  });
};

export const getAllFollowups: RequestHandler = async (_req, res) => {
  const followups = await followupModel.getAllFollowups();
  res.status(200).json({ message: "All follow-ups", count: followups.length, data: followups });
};

export const getPendingFollowups: RequestHandler = async (_req, res) => {
  const followups = await followupModel.getPendingFollowups();
  res.status(200).json({ message: "Pending follow-ups", count: followups.length, data: followups });
};

export const getOverdueFollowups: RequestHandler = async (_req, res) => {
  const followups = await followupModel.getOverdueFollowups();
  res.status(200).json({
    message: "Overdue follow-ups (automatically marked as Missed)",
    count: followups.length,
    data: followups,
  });
};

export const updateFollowupStatus: RequestHandler = async (req, res) => {
  const id = Number(req.params["id"]);
  if (!id || isNaN(id)) {
    res.status(400).json({ message: "Invalid follow-up id" });
    return;
  }

  const existing = await followupModel.getFollowupById(id);
  if (!existing) {
    res.status(404).json({ message: `Follow-up with id ${id} not found` });
    return;
  }

  if (existing.status === "Converted") {
    res.status(409).json({ message: "Cannot change status of a Converted follow-up" });
    return;
  }

  const payload = updateFollowupSchema.parse(req.body);

  const updated = await followupModel.updateFollowupStatus(id, {
    status: payload.status,
    saleAmount: payload.sale_amount,
    invoiceNumber: payload.invoice_number,
    followupDate: payload.followup_date,
  });

  res.status(200).json({ message: "Follow-up updated successfully", data: updated });
};
