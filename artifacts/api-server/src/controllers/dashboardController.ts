import type { RequestHandler } from "express";
import * as dashboardModel from "../models/dashboardModel";

export const getVisitsPerUser: RequestHandler = async (req, res) => {
  const period = req.query["period"];

  if (period !== "daily" && period !== "weekly") {
    res.status(400).json({
      message: "period query param is required and must be 'daily' or 'weekly'",
    });
    return;
  }

  const data =
    period === "daily"
      ? await dashboardModel.visitsPerUserDaily()
      : await dashboardModel.visitsPerUserWeekly();

  res.status(200).json({ period, data });
};

export const getTotalVisits: RequestHandler = async (_req, res) => {
  const data = await dashboardModel.totalVisitsCounts();
  res.status(200).json({ data });
};

export const getFeedbackSummary: RequestHandler = async (_req, res) => {
  const data = await dashboardModel.feedbackSummary();
  res.status(200).json({ data });
};

export const getInactiveUsersToday: RequestHandler = async (_req, res) => {
  const data = await dashboardModel.inactiveUsersToday();
  res.status(200).json({ data });
};
