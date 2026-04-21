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

export const getPendingFollowups: RequestHandler = async (_req, res) => {
  const followups = await followupModel.getPendingFollowups();

  res.status(200).json({
    message: "Pending follow-ups",
    count: followups.length,
    data: followups,
  });
};

export const getOverdueFollowups: RequestHandler = async (_req, res) => {
  const followups = await followupModel.getOverdueFollowups();

  res.status(200).json({
    message: "Overdue follow-ups (automatically marked as Missed)",
    count: followups.length,
    data: followups,
  });
};
