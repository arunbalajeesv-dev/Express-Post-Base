import type { RequestHandler } from "express";
import { z } from "zod/v4";
import * as customerModel from "../models/customerModel";
import * as visitModel from "../models/visitModel";

const mobileRegex = /^[6-9]\d{9}$/;

const addVisitSchema = z.object({
  customer_name: z.string().trim().min(1, "Customer name is required"),
  mobile_number: z
    .string()
    .trim()
    .regex(mobileRegex, "Mobile number must be a valid 10-digit Indian number starting with 6-9"),
  company_name: z.string().trim().optional(),
  area: z.string().trim().optional(),
  site_stage: z.string().trim().optional(),
  feedback: z.enum(["Interested", "Not Interested", "Potential"], {
    error: "Feedback must be one of: Interested, Not Interested, Potential",
  }),
  notes: z.string().trim().optional(),
  image_url: z.string().trim().min(1, "Image URL is required"),
});

export const createVisit: RequestHandler = async (req, res) => {
  const payload = addVisitSchema.parse(req.body);

  const now = new Date();
  const visitDate = now.toISOString().slice(0, 10);
  const visitTime = now.toTimeString().slice(0, 8);

  let customer = await customerModel.findByMobile(payload.mobile_number);

  if (!customer) {
    customer = await customerModel.createCustomer({
      name: payload.customer_name,
      mobile: payload.mobile_number,
      companyName: payload.company_name,
    });
  }

  const result = await visitModel.createVisitWithBrands({
    userId: req.user!.id,
    customerId: customer.id,
    area: payload.area,
    siteStage: payload.site_stage,
    feedback: payload.feedback,
    visitDate,
    visitTime,
    notes: payload.notes,
    imageUrl: payload.image_url,
  });

  res.status(201).json({
    message: "Visit recorded successfully",
    data: {
      visit: result.visit,
      customer,
    },
  });
};
