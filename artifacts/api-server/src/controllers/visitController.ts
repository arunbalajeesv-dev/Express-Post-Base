import type { RequestHandler } from "express";
import { z } from "zod/v4";
import * as customerModel from "../models/customerModel";
import * as visitModel from "../models/visitModel";

export const listVisits: RequestHandler = async (req, res) => {
  const user = req.user!;
  const isManager = user.role === "Manager" || user.role === "manager";
  const visits = isManager
    ? await visitModel.listVisits()
    : await visitModel.listVisits(user.id);
  res.json({ data: visits });
};

const mobileRegex = /^[6-9]\d{9}$/;

const brandEntrySchema = z.object({
  brandId: z.number().int().positive().optional(),
  customBrandName: z.string().trim().min(1).optional(),
});

const SITE_STAGE_VALUES = [
  "New Site/ Foundation",
  "Brickwork",
  "Plastering",
  "Roofing",
  "Painting/ Tiles",
  "Plumbing/ Electrical",
  "Finishing Stage",
] as const;

const CUSTOMER_TYPE_VALUES = [
  "Owner",
  "Purchase Manager",
  "Site Manager",
  "Site Mistry",
  "Technician",
  "Others",
] as const;

const addVisitSchema = z
  .object({
    customer_name:        z.string().trim().min(1, "Customer name is required"),
    mobile_number:        z.string().trim().regex(mobileRegex, "Must be a valid 10-digit Indian mobile number starting with 6-9"),
    company_name:         z.string().trim().optional(),
    customer_type:        z.enum(CUSTOMER_TYPE_VALUES, {
      error: `Customer type must be one of: ${CUSTOMER_TYPE_VALUES.join(", ")}`,
    }),
    custom_customer_type: z.string().trim().optional(),
    area:                 z.string().trim().min(1, "Area is required"),
    layout:               z.string().trim().optional(),
    location_link:        z.string().trim().min(1, "Location link is required"),
    site_stage:           z.enum(SITE_STAGE_VALUES, {
      error: `Site stage must be one of: ${SITE_STAGE_VALUES.join(", ")}`,
    }),
    brands_used:          z.array(brandEntrySchema).min(1, "At least one brand must be selected"),
    feedback:             z.enum(["Interested", "Not Interested", "Potential"], {
      error: "Feedback must be Interested, Not Interested, or Potential",
    }),
    notes:                z.string().trim().min(1, "Notes are required"),
    image_url:            z.string().trim().min(1, "Photo is required — please upload an image"),
  })
  .superRefine((data, ctx) => {
    if (data.customer_type === "Others" && !data.custom_customer_type?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["custom_customer_type"],
        message: "Please specify the customer type when 'Others' is selected",
      });
    }
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
  } else {
    customer = await customerModel.updateCompanyName(customer.id, payload.company_name);
  }

  const brandLinks = payload.brands_used.map((b) => ({
    brandId: b.brandId ?? null,
    customBrandName: b.customBrandName ?? null,
  }));

  const result = await visitModel.createVisitWithBrands(
    {
      userId: req.user!.id,
      customerId: customer.id,
      area: payload.area,
      layout: payload.layout,
      locationLink: payload.location_link,
      siteStage: payload.site_stage,
      feedback: payload.feedback,
      visitDate,
      visitTime,
      notes: payload.notes,
      imageUrl: payload.image_url,
      customerType: payload.customer_type,
      customCustomerType: payload.customer_type === "Others"
        ? (payload.custom_customer_type ?? null)
        : null,
    },
    brandLinks,
  );

  res.status(201).json({
    message: "Visit recorded successfully",
    data: {
      visit: result.visit,
      customer,
    },
  });
};
