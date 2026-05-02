import type { RequestHandler } from "express";
import * as dashboardModel from "../models/dashboardModel";

export const getBrandStats: RequestHandler = async (_req, res) => {
  const data = await dashboardModel.brandUsageStats();
  res.status(200).json({ data });
};

export const getFollowupAgentBreakdown: RequestHandler = async (req, res) => {
  const from = typeof req.query["from"] === "string" ? req.query["from"] : undefined;
  const to   = typeof req.query["to"]   === "string" ? req.query["to"]   : undefined;
  const data = await dashboardModel.followupAgentBreakdown(from, to);
  res.status(200).json({ data });
};

export const getVisitsPerUser: RequestHandler = async (req, res) => {
  const period = req.query["period"];

  if (period !== "daily" && period !== "weekly" && period !== "monthly") {
    res.status(400).json({
      message: "period query param is required and must be 'daily', 'weekly', or 'monthly'",
    });
    return;
  }

  const data =
    period === "daily"
      ? await dashboardModel.visitsPerUserDaily()
      : period === "weekly"
      ? await dashboardModel.visitsPerUserWeekly()
      : await dashboardModel.visitsPerUserMonthly();

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

export const getConversionSummary: RequestHandler = async (_req, res) => {
  const data = await dashboardModel.conversionSummary();
  res.status(200).json({ data });
};

export const getMyStats: RequestHandler = async (req, res) => {
  const agentId = req.user!.id;
  const from = typeof req.query["from"] === "string" ? req.query["from"] : undefined;
  const to   = typeof req.query["to"]   === "string" ? req.query["to"]   : undefined;
  const data = await dashboardModel.agentDetail(agentId, from, to);
  if (!data) { res.status(404).json({ message: "Agent not found" }); return; }
  res.status(200).json({ data });
};

export const getAgentDetail: RequestHandler = async (req, res) => {
  const agentId = parseInt(req.params["id"] ?? "", 10);
  if (isNaN(agentId)) { res.status(400).json({ message: "Invalid agent ID" }); return; }
  const from = typeof req.query["from"] === "string" ? req.query["from"] : undefined;
  const to   = typeof req.query["to"]   === "string" ? req.query["to"]   : undefined;
  const data = await dashboardModel.agentDetail(agentId, from, to);
  if (!data) { res.status(404).json({ message: "Agent not found" }); return; }
  res.status(200).json({ data });
};
