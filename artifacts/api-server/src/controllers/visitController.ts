import type { RequestHandler } from "express";
import { z } from "zod/v4";
import * as brandModel from "../models/brandModel";
import * as visitModel from "../models/visitModel";

const brandUsedSchema = z.object({
  brand_id: z.number().int().positive().optional(),
  custom_brand_name: z.string().trim().optional(),
});

const addVisitSchema = z.object({
  user_id: z.number().int().positive(),
  customer_id: z.number().int().positive(),
  area: z.string().optional(),
  site_stage: z.string().optional(),
  feedback: z.string().optional(),
  visit_date: z.string().min(1, "Visit date is required"),
  visit_time: z.string().min(1, "Visit time is required"),
  notes: z.string().optional(),
  image_url: z.string().optional(),
  brands_used: z.array(brandUsedSchema).min(1, "At least one brand must be selected"),
});

function validateBrandsUsed(
  brandsUsed: z.infer<typeof addVisitSchema>["brands_used"],
) {
  const brandIds = new Set<number>();
  const customBrandNames = new Set<string>();
  const errors: string[] = [];

  for (const [index, brandUsed] of brandsUsed.entries()) {
    const customBrandName = brandUsed.custom_brand_name?.trim();

    if (!brandUsed.brand_id && !customBrandName) {
      errors.push(`brands_used[${index}] requires brand_id or custom_brand_name`);
      continue;
    }

    if (brandUsed.brand_id && customBrandName) {
      errors.push(`brands_used[${index}] cannot include both brand_id and custom_brand_name`);
      continue;
    }

    if (brandUsed.brand_id) {
      if (brandIds.has(brandUsed.brand_id)) {
        errors.push(`Duplicate brand_id ${brandUsed.brand_id} for this visit`);
      }

      brandIds.add(brandUsed.brand_id);
    }

    if (customBrandName) {
      const normalizedName = customBrandName.toLowerCase();

      if (customBrandNames.has(normalizedName)) {
        errors.push(`Duplicate custom brand "${customBrandName}" for this visit`);
      }

      customBrandNames.add(normalizedName);
    }
  }

  return errors;
}

export const createVisit: RequestHandler = async (req, res) => {
  const payload = addVisitSchema.parse(req.body);
  const brandErrors = validateBrandsUsed(payload.brands_used);

  if (brandErrors.length > 0) {
    res.status(400).json({ message: "Brand validation failed", errors: brandErrors });
    return;
  }

  const brandLinks = [];

  for (const brandUsed of payload.brands_used) {
    if (brandUsed.brand_id) {
      const brand = await brandModel.findBrandById(brandUsed.brand_id);

      if (!brand) {
        res.status(400).json({
          message: `Brand with id ${brandUsed.brand_id} does not exist`,
        });
        return;
      }

      brandLinks.push({ brandId: brandUsed.brand_id, customBrandName: null });
      continue;
    }

    brandLinks.push({
      brandId: null,
      customBrandName: brandUsed.custom_brand_name?.trim() ?? null,
    });
  }

  const result = await visitModel.createVisitWithBrands(
    {
      userId: payload.user_id,
      customerId: payload.customer_id,
      area: payload.area,
      siteStage: payload.site_stage,
      feedback: payload.feedback,
      visitDate: payload.visit_date,
      visitTime: payload.visit_time,
      notes: payload.notes,
      imageUrl: payload.image_url,
    },
    brandLinks,
  );

  res.status(201).json({
    message: "Visit created",
    data: result,
  });
};