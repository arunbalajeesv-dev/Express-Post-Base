// Matches the profiles table: profiles.id = auth.users.id (UUID)
export type Profile = {
  id: string;
  name: string;
  role: string;
  mobile: string | null;
};

// visits table — user_id references profiles.id (auth.uid)
export type Visit = {
  id: number;
  user_id: string;
  customer_name: string;
  customer_mobile: string | null;
  company_name: string | null;
  customer_type: string | null;
  area: string | null;
  site_stage: string | null;
  feedback: "Interested" | "Potential" | "Not Interested" | null;
  visit_date: string;
  notes: string | null;
  image_url: string | null;
  location_link: string | null;
};

// followups table — visit_id references visits.id
export type Followup = {
  id: number;
  visit_id: number;
  followup_date: string;
  status: "Pending" | "Completed" | "Converted";
  notes: string | null;
  spoke_to_customer: boolean | null;
  quotation_sent: boolean | null;
  sale_amount: string | null;
  invoice_number: string | null;
  // joined from visits
  customer_name: string;
  customer_mobile: string | null;
};

export const SITE_STAGES = [
  "New Site/ Foundation",
  "Brickwork",
  "Plastering",
  "Roofing",
  "Painting/ Tiles",
  "Plumbing/ Electrical",
  "Finishing Stage",
] as const;

export const FEEDBACK_OPTIONS = ["Interested", "Potential", "Not Interested"] as const;

export const CUSTOMER_TYPES = [
  "Owner",
  "Purchase Manager",
  "Site Manager",
  "Site Mastery",
  "Technician",
  "Others",
] as const;

export const AREA_OPTIONS = [
  "North Zone",
  "South Zone",
  "East Zone",
  "West Zone",
  "Central",
  "Suburban",
  "Industrial",
  "Other",
] as const;
