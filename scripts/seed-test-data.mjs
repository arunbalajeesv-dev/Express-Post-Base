/**
 * ============================================================
 *  TEST DATA SEED — Sales Tracking App
 * ============================================================
 *  Creates: 2 agents, 10 customers, 25 visits, 9 brands,
 *           brand links, and 21 follow-ups
 *
 *  HOW TO RUN (from the project root folder):
 *    cd scripts
 *    node --env-file="..\artifacts\api-server\.env" seed-test-data.mjs
 * ============================================================
 */

import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set. Make sure you run with --env-file flag.");
  process.exit(1);
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);         // "YYYY-MM-DD"
}

// ─── AGENTS ──────────────────────────────────────────────────────────────────
// Both agents will use password: Agent@123

const AGENTS = [
  { userId: "agent01", name: "Ravi Kumar",   mobile: "9800100001", role: "Sales" },
  { userId: "agent02", name: "Priya Sharma", mobile: "9800100002", role: "Sales" },
];

// ─── BRANDS ──────────────────────────────────────────────────────────────────

const BRANDS = [
  "Ramco", "Dalmia", "Ultratech", "Zuari", "Chettinad",
  "Asian Paints", "Birla", "Dr.Fixit", "Polycab",
];

// ─── CUSTOMERS ───────────────────────────────────────────────────────────────

const CUSTOMERS = [
  { name: "Suresh Babu",    mobile: "9876543210", company: "Chennai Constructions Pvt Ltd" },
  { name: "Lakshmi Devi",   mobile: "9876543211", company: null },
  { name: "Ramesh Iyer",    mobile: "9876543212", company: "Iyer Infrastructure" },
  { name: "Kavitha Nair",   mobile: "9876543213", company: "Nair Builders" },
  { name: "Mohan Das",      mobile: "9876543214", company: "Das Real Estate" },
  { name: "Anand Raj",      mobile: "9876543215", company: null },
  { name: "Fatima Begum",   mobile: "9876543216", company: "Begum Developers" },
  { name: "Vijay Kumar",    mobile: "9876543217", company: "VK Constructions" },
  { name: "Sunita Patel",   mobile: "9876543218", company: null },
  { name: "Deepak Mehta",   mobile: "9876543219", company: "Mehta Group" },
];

// ─── VISITS ──────────────────────────────────────────────────────────────────
// agentIdx  → index into AGENTS  (0 = Ravi, 1 = Priya)
// custIdx   → index into CUSTOMERS (0-9)
// daysAgo   → how many days before today the visit happened (0 = today)
// brands    → standard brand names (must match BRANDS array exactly)
// customBrand → optional "Other" brand text
// customerType "Others" requires customCustomerType field

const VISITS = [

  // ── Suresh Babu — 3 visits (Foundation → Brickwork → Plastering) ──────────
  {
    agentIdx: 0, custIdx: 0, daysAgo: 15, time: "09:30:00",
    area: "Anna Nagar", layout: "Sri Sai Residency",
    locationLink: "https://maps.google.com/?q=13.0850,80.2101",
    siteStage: "New Site/ Foundation", customerType: "Owner",
    feedback: "Interested",
    notes: "Foundation work in progress. Owner confirmed interest in Ramco cement for the entire project.",
    brands: ["Ramco", "Dalmia"],
  },
  {
    agentIdx: 0, custIdx: 0, daysAgo: 7, time: "10:30:00",
    area: "Anna Nagar", layout: "Sri Sai Residency",
    locationLink: "https://maps.google.com/?q=13.0850,80.2101",
    siteStage: "Brickwork", customerType: "Owner",
    feedback: "Interested",
    notes: "Brickwork 60% complete. Owner confirmed bulk order interest. Shared pricing for next phase.",
    brands: ["Ultratech", "Dr.Fixit"],
  },
  {
    agentIdx: 0, custIdx: 0, daysAgo: 0, time: "11:00:00",
    area: "Anna Nagar", layout: "Sri Sai Residency",
    locationLink: "https://maps.google.com/?q=13.0850,80.2101",
    siteStage: "Plastering", customerType: "Owner",
    feedback: "Interested",
    notes: "Plastering started today. Delivery schedule confirmed with owner for Birla White.",
    brands: ["Birla", "Ramco"],
  },

  // ── Lakshmi Devi — 2 visits (Plastering → Roofing) ───────────────────────
  {
    agentIdx: 1, custIdx: 1, daysAgo: 13, time: "14:00:00",
    area: "T.Nagar", layout: null,
    locationLink: "https://maps.google.com/?q=13.0418,80.2341",
    siteStage: "Plastering", customerType: "Purchase Manager",
    feedback: "Potential",
    notes: "Purchase manager reviewing multiple vendors. Requested full product catalogue.",
    brands: ["Asian Paints", "Birla"],
  },
  {
    agentIdx: 1, custIdx: 1, daysAgo: 5, time: "15:00:00",
    area: "T.Nagar", layout: null,
    locationLink: "https://maps.google.com/?q=13.0418,80.2341",
    siteStage: "Roofing", customerType: "Purchase Manager",
    feedback: "Potential",
    notes: "Shared updated catalogue. Comparing Dr.Fixit and Pidilite for waterproofing — decision pending.",
    brands: ["Dr.Fixit", "Polycab"],
  },

  // ── Ramesh Iyer — 3 visits (Brickwork → Plastering → Roofing) ───────────
  {
    agentIdx: 0, custIdx: 2, daysAgo: 12, time: "09:00:00",
    area: "Adyar", layout: "Iyer Villas Phase 2",
    locationLink: "https://maps.google.com/?q=13.0012,80.2565",
    siteStage: "Brickwork", customerType: "Site Manager",
    feedback: "Interested",
    notes: "Site manager confirmed Dalmia cement for the entire brickwork phase. PO expected next week.",
    brands: ["Dalmia", "Chettinad"],
  },
  {
    agentIdx: 0, custIdx: 2, daysAgo: 6, time: "10:00:00",
    area: "Adyar", layout: "Iyer Villas Phase 2",
    locationLink: "https://maps.google.com/?q=13.0012,80.2565",
    siteStage: "Plastering", customerType: "Site Manager",
    feedback: "Interested",
    notes: "Plastering in progress. Birla White approved for internal walls. Quotation sent.",
    brands: ["Zuari", "Birla"],
  },
  {
    agentIdx: 1, custIdx: 2, daysAgo: 2, time: "11:30:00",
    area: "Adyar", layout: "Iyer Villas Phase 2",
    locationLink: "https://maps.google.com/?q=13.0012,80.2565",
    siteStage: "Roofing", customerType: "Site Manager",
    feedback: "Interested",
    notes: "Roofing work started. Ramco cement and Polycab wiring finalised for Phase 3.",
    brands: ["Ramco", "Polycab"],
  },

  // ── Kavitha Nair — 2 visits (Foundation → Brickwork) ─────────────────────
  {
    agentIdx: 1, custIdx: 3, daysAgo: 14, time: "08:30:00",
    area: "Velachery", layout: "Nair Garden View",
    locationLink: "https://maps.google.com/?q=12.9815,80.2180",
    siteStage: "New Site/ Foundation", customerType: "Owner",
    feedback: "Interested",
    notes: "New residential project. Owner keen on Ultratech Premium for foundation work.",
    brands: ["Ultratech", "Ramco"],
  },
  {
    agentIdx: 1, custIdx: 3, daysAgo: 7, time: "16:00:00",
    area: "Velachery", layout: "Nair Garden View",
    locationLink: "https://maps.google.com/?q=12.9815,80.2180",
    siteStage: "Brickwork", customerType: "Owner",
    feedback: "Potential",
    notes: "Brickwork progressing. Owner still comparing Dalmia vs Chettinad — price list shared.",
    brands: ["Dalmia", "Chettinad"],
    customBrand: "Shree Cement",
  },

  // ── Mohan Das — 3 visits (Finishing × 3) ─────────────────────────────────
  {
    agentIdx: 0, custIdx: 4, daysAgo: 11, time: "09:45:00",
    area: "Porur", layout: "Das Heights",
    locationLink: "https://maps.google.com/?q=13.0358,80.1574",
    siteStage: "Finishing Stage", customerType: "Owner",
    feedback: "Interested",
    notes: "Project nearing completion. Asian Paints and Dr.Fixit confirmed for finishing works.",
    brands: ["Asian Paints", "Dr.Fixit"],
  },
  {
    agentIdx: 0, custIdx: 4, daysAgo: 4, time: "10:15:00",
    area: "Porur", layout: "Das Heights",
    locationLink: "https://maps.google.com/?q=13.0358,80.1574",
    siteStage: "Finishing Stage", customerType: "Owner",
    feedback: "Interested",
    notes: "Owner confirmed purchase order for full finishing package. Invoice to be raised immediately.",
    brands: ["Asian Paints", "Polycab", "Dr.Fixit"],
  },
  {
    agentIdx: 0, custIdx: 4, daysAgo: 0, time: "14:30:00",
    area: "Porur", layout: "Das Heights",
    locationLink: "https://maps.google.com/?q=13.0358,80.1574",
    siteStage: "Finishing Stage", customerType: "Owner",
    feedback: "Interested",
    notes: "Final delivery coordinated. Owner very satisfied with product quality and service.",
    brands: ["Birla"],
    customBrand: "Sika Waterproofing",
  },

  // ── Anand Raj — 2 visits (Painting/Tiles both, "Others: Architect") ───────
  {
    agentIdx: 1, custIdx: 5, daysAgo: 10, time: "13:00:00",
    area: "OMR", layout: null,
    locationLink: "https://maps.google.com/?q=12.9010,80.2279",
    siteStage: "Painting/ Tiles", customerType: "Others",
    customCustomerType: "Architect",
    feedback: "Not Interested",
    notes: "Architect already committed to another vendor. Not pursuing for now — will revisit in Q3.",
    brands: ["Asian Paints", "Birla"],
  },
  {
    agentIdx: 0, custIdx: 5, daysAgo: 3, time: "11:00:00",
    area: "OMR", layout: null,
    locationLink: "https://maps.google.com/?q=12.9010,80.2279",
    siteStage: "Painting/ Tiles", customerType: "Others",
    customCustomerType: "Architect",
    feedback: "Potential",
    notes: "Re-approached after previous vendor pulled out. Architect open to comparing pricing.",
    brands: ["Asian Paints"],
    customBrand: "Nerolac",
  },

  // ── Fatima Begum — 3 visits (Plumbing → Finishing → Finishing today) ──────
  {
    agentIdx: 0, custIdx: 6, daysAgo: 9, time: "10:30:00",
    area: "Tambaram", layout: "Begum Enclave Block A",
    locationLink: "https://maps.google.com/?q=12.9249,80.1000",
    siteStage: "Plumbing/ Electrical", customerType: "Purchase Manager",
    feedback: "Interested",
    notes: "Discussed Polycab wiring for the entire complex. Purchase manager very interested.",
    brands: ["Polycab", "Zuari"],
  },
  {
    agentIdx: 1, custIdx: 6, daysAgo: 5, time: "14:00:00",
    area: "Tambaram", layout: "Begum Enclave Block A",
    locationLink: "https://maps.google.com/?q=12.9249,80.1000",
    siteStage: "Finishing Stage", customerType: "Purchase Manager",
    feedback: "Interested",
    notes: "Quotation accepted. Finalised Dr.Fixit and Asian Paints for the entire finishing phase.",
    brands: ["Dr.Fixit", "Asian Paints"],
  },
  {
    agentIdx: 1, custIdx: 6, daysAgo: 0, time: "15:30:00",
    area: "Tambaram", layout: "Begum Enclave Block A",
    locationLink: "https://maps.google.com/?q=12.9249,80.1000",
    siteStage: "Finishing Stage", customerType: "Purchase Manager",
    feedback: "Interested",
    notes: "Delivery confirmed today. Customer satisfied with service. Referral promised.",
    brands: ["Polycab", "Dr.Fixit"],
  },

  // ── Vijay Kumar — 2 visits (Roofing → Painting) ──────────────────────────
  {
    agentIdx: 1, custIdx: 7, daysAgo: 13, time: "09:00:00",
    area: "Chromepet", layout: "VK Towers Block 2",
    locationLink: "https://maps.google.com/?q=12.9508,80.1391",
    siteStage: "Roofing", customerType: "Site Mastery",
    feedback: "Potential",
    notes: "Site mason comparing Ramco and Chettinad for roofing slab. Cost estimate requested.",
    brands: ["Ramco", "Chettinad"],
  },
  {
    agentIdx: 1, custIdx: 7, daysAgo: 4, time: "11:30:00",
    area: "Chromepet", layout: "VK Towers Block 2",
    locationLink: "https://maps.google.com/?q=12.9508,80.1391",
    siteStage: "Painting/ Tiles", customerType: "Site Mastery",
    feedback: "Not Interested",
    notes: "Owner decided on local vendor for tiles. Will re-approach for next tower project.",
    brands: ["Asian Paints", "Birla"],
  },

  // ── Sunita Patel — 2 visits (Foundation → Brickwork) ─────────────────────
  {
    agentIdx: 0, custIdx: 8, daysAgo: 8, time: "08:45:00",
    area: "Thiruvanmiyur", layout: null,
    locationLink: "https://maps.google.com/?q=12.9824,80.2653",
    siteStage: "New Site/ Foundation", customerType: "Owner",
    feedback: "Interested",
    notes: "New villa project. Owner keen on Ultratech Premium for foundation and column work.",
    brands: ["Ultratech", "Ramco"],
  },
  {
    agentIdx: 0, custIdx: 8, daysAgo: 1, time: "12:00:00",
    area: "Thiruvanmiyur", layout: null,
    locationLink: "https://maps.google.com/?q=12.9824,80.2653",
    siteStage: "Brickwork", customerType: "Owner",
    feedback: "Potential",
    notes: "Brickwork commenced. Shared Dalmia technical specs. Owner wants to verify before full order.",
    brands: ["Dalmia"],
    customBrand: "JSW Steel",
  },

  // ── Deepak Mehta — 3 visits (Brickwork → Plastering → Roofing today) ─────
  {
    agentIdx: 1, custIdx: 9, daysAgo: 15, time: "09:30:00",
    area: "Padi", layout: "Mehta Grand Phase 1",
    locationLink: "https://maps.google.com/?q=13.1117,80.2048",
    siteStage: "Brickwork", customerType: "Technician",
    feedback: "Potential",
    notes: "Site engineer evaluating Chettinad and Zuari for large residential complex.",
    brands: ["Chettinad", "Zuari"],
  },
  {
    agentIdx: 0, custIdx: 9, daysAgo: 7, time: "14:30:00",
    area: "Padi", layout: "Mehta Grand Phase 1",
    locationLink: "https://maps.google.com/?q=13.1117,80.2048",
    siteStage: "Plastering", customerType: "Technician",
    feedback: "Interested",
    notes: "Technical evaluation complete. Birla White approved for plastering. Quote accepted.",
    brands: ["Birla", "Dr.Fixit", "Zuari"],
  },
  {
    agentIdx: 1, custIdx: 9, daysAgo: 0, time: "10:00:00",
    area: "Padi", layout: "Mehta Grand Phase 1",
    locationLink: "https://maps.google.com/?q=13.1117,80.2048",
    siteStage: "Roofing", customerType: "Technician",
    feedback: "Interested",
    notes: "Roofing phase started. Ramco cement and Polycab wiring selected for structural works.",
    brands: ["Ramco", "Polycab"],
  },
];

// ─── FOLLOW-UPS ──────────────────────────────────────────────────────────────
// visitIdx → index into VISITS array (0-based, must match exactly)
// Completed: requires summary, spoke (bool), quotationSent (bool), quotationNumber (if sent=true)
// Converted: requires invoiceNumber and saleAmount
// Pending:   requires only date and optional notes

const FOLLOWUPS = [

  // ── Completed ─────────────────────────────────────────────────────────────
  {
    visitIdx: 0,                                       // Suresh Babu — Foundation
    date: dateStr(-11), status: "Completed",
    notes: "Followed up on Ramco cement order quantity.",
    summary: "Met with owner. Confirmed bulk order for brickwork phase. Quotation accepted.",
    spoke: true, quotationSent: true, quotationNumber: "QT-2026-001",
  },
  {
    visitIdx: 3,                                       // Lakshmi Devi — Plastering
    date: dateStr(-10), status: "Completed",
    notes: "Follow-up on catalogue request.",
    summary: "Spoke with purchase manager. She reviewed our catalogue but vendor decision still pending.",
    spoke: true, quotationSent: false,
  },
  {
    visitIdx: 5,                                       // Ramesh Iyer — Brickwork
    date: dateStr(-9), status: "Completed",
    notes: "Confirmed Dalmia cement order status.",
    summary: "Site manager confirmed PO for Dalmia. Also requested quotation for Phase 3 plastering.",
    spoke: true, quotationSent: true, quotationNumber: "QT-2026-002",
  },
  {
    visitIdx: 8,                                       // Kavitha Nair — Foundation
    date: dateStr(-10), status: "Completed",
    notes: "Follow-up on Ultratech Premium interest.",
    summary: "Owner comparing with another vendor. No decision yet — will follow up again next week.",
    spoke: false, quotationSent: false,
  },
  {
    visitIdx: 10,                                      // Mohan Das — Finishing visit 1
    date: dateStr(-8), status: "Completed",
    notes: "Followed up on finishing materials discussion.",
    summary: "Owner reviewed quotation carefully. Very happy with Asian Paints pricing. Order finalising.",
    spoke: true, quotationSent: true, quotationNumber: "QT-2026-003",
  },
  {
    visitIdx: 13,                                      // Anand Raj — Painting visit 1
    date: dateStr(-7), status: "Completed",
    notes: "Re-checking if architect changed decision after vendor issues.",
    summary: "Architect confirmed original vendor commitment. Will revisit prospect in Q3 2026.",
    spoke: true, quotationSent: false,
  },
  {
    visitIdx: 18,                                      // Vijay Kumar — Roofing
    date: dateStr(-10), status: "Completed",
    notes: "Follow-up on cost estimate for roofing slab.",
    summary: "Site mason shared our estimate with owner. Owner asked for an additional 5% discount.",
    spoke: true, quotationSent: false,
  },

  // ── Converted ─────────────────────────────────────────────────────────────
  {
    visitIdx: 7,                                       // Ramesh Iyer — Roofing (Phase 3)
    date: dateStr(0), status: "Converted",
    notes: "Final PO confirmed for Ramco + Polycab package for Phase 3.",
    invoiceNumber: "INV-2026-001",
    saleAmount: "345000",
  },
  {
    visitIdx: 11,                                      // Mohan Das — Finishing (full supply)
    date: dateStr(-2), status: "Converted",
    notes: "Full supply contract signed for Das Heights finishing materials.",
    invoiceNumber: "INV-2026-002",
    saleAmount: "280000",
  },
  {
    visitIdx: 16,                                      // Fatima Begum — Finishing Phase
    date: dateStr(-1), status: "Converted",
    notes: "PO received for Polycab + Dr.Fixit + Asian Paints package — Begum Enclave.",
    invoiceNumber: "INV-2026-003",
    saleAmount: "192500",
  },
  {
    visitIdx: 23,                                      // Deepak Mehta — Plastering phase
    date: dateStr(0), status: "Converted",
    notes: "Large plastering order placed — Birla White + Dr.Fixit + Zuari for entire complex.",
    invoiceNumber: "INV-2026-004",
    saleAmount: "415000",
  },

  // ── Pending ───────────────────────────────────────────────────────────────
  {
    visitIdx: 1,                                       // Suresh Babu — Brickwork
    date: dateStr(2), status: "Pending",
    notes: "Confirm roofing material quantities for the next phase.",
  },
  {
    visitIdx: 4,                                       // Lakshmi Devi — Roofing
    date: dateStr(4), status: "Pending",
    notes: "Call to confirm Dr.Fixit waterproofing decision — order expected this week.",
  },
  {
    visitIdx: 6,                                       // Ramesh Iyer — Plastering
    date: dateStr(3), status: "Pending",
    notes: "Confirm Birla White delivery schedule for Phase 3.",
  },
  {
    visitIdx: 9,                                       // Kavitha Nair — Brickwork
    date: dateStr(5), status: "Pending",
    notes: "Awaiting price comparison decision from owner — Dalmia vs Chettinad.",
  },
  {
    visitIdx: 14,                                      // Anand Raj — Painting visit 2
    date: dateStr(7), status: "Pending",
    notes: "Follow up on revised quotation — architect reconsidering options.",
  },
  {
    visitIdx: 15,                                      // Fatima Begum — Plumbing
    date: dateStr(1), status: "Pending",
    notes: "Confirm Polycab wiring quantities for Block B of Begum Enclave.",
  },
  {
    visitIdx: 19,                                      // Vijay Kumar — Painting
    date: dateStr(6), status: "Pending",
    notes: "Check if owner reconsiders Asian Paints for the second tower project.",
  },
  {
    visitIdx: 20,                                      // Sunita Patel — Foundation
    date: dateStr(4), status: "Pending",
    notes: "Check Ultratech delivery timeline and confirm foundation order.",
  },
  {
    visitIdx: 21,                                      // Sunita Patel — Brickwork
    date: dateStr(8), status: "Pending",
    notes: "Confirm Dalmia order for remaining brickwork after owner verification.",
  },
  {
    visitIdx: 22,                                      // Deepak Mehta — Brickwork
    date: dateStr(2), status: "Pending",
    notes: "Chettinad supply agreement decision pending with MD of Mehta Group.",
  },
];

// ─── SEED FUNCTION ───────────────────────────────────────────────────────────

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log("Connected to database.\n");

  try {
    await client.query("BEGIN");

    // ── 1. Agents ────────────────────────────────────────────────────────────
    console.log("Inserting agents...");
    const agentIds = [];
    const hashedPassword = await bcrypt.hash("Agent@123", 10);

    for (const agent of AGENTS) {
      const existing = await client.query(
        "SELECT id FROM users WHERE user_id = $1",
        [agent.userId],
      );
      if (existing.rows.length > 0) {
        agentIds.push(existing.rows[0].id);
        console.log(`  ✓ ${agent.name} (${agent.userId}) already exists — skipped`);
      } else {
        const r = await client.query(
          `INSERT INTO users (user_id, name, mobile, role, password)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [agent.userId, agent.name, agent.mobile, agent.role, hashedPassword],
        );
        agentIds.push(r.rows[0].id);
        console.log(`  + ${agent.name} (${agent.userId}) created — id ${r.rows[0].id}`);
      }
    }

    // ── 2. Brands ────────────────────────────────────────────────────────────
    console.log("\nInserting brands...");
    const brandIdMap = {};   // { "Ramco": 3, "Dalmia": 4, ... }

    for (const name of BRANDS) {
      await client.query(
        "INSERT INTO brands (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
        [name],
      );
      const r = await client.query("SELECT id FROM brands WHERE name = $1", [name]);
      brandIdMap[name] = r.rows[0].id;
      console.log(`  ✓ ${name} — id ${r.rows[0].id}`);
    }

    // ── 3. Customers ─────────────────────────────────────────────────────────
    console.log("\nInserting customers...");
    const customerIds = [];

    for (const c of CUSTOMERS) {
      const existing = await client.query(
        "SELECT id FROM customers WHERE mobile = $1",
        [c.mobile],
      );
      if (existing.rows.length > 0) {
        customerIds.push(existing.rows[0].id);
        console.log(`  ✓ ${c.name} already exists — skipped`);
      } else {
        const r = await client.query(
          `INSERT INTO customers (name, mobile, company_name)
           VALUES ($1, $2, $3) RETURNING id`,
          [c.name, c.mobile, c.company],
        );
        customerIds.push(r.rows[0].id);
        console.log(`  + ${c.name} created — id ${r.rows[0].id}`);
      }
    }

    // ── 4. Visits + Brand Links ───────────────────────────────────────────────
    console.log("\nInserting visits and brand links...");
    const visitIds = [];   // indexed by position in VISITS array

    for (let i = 0; i < VISITS.length; i++) {
      const v = VISITS[i];
      const agentId    = agentIds[v.agentIdx];
      const customerId = customerIds[v.custIdx];
      const visitDate  = dateStr(-v.daysAgo);

      const r = await client.query(
        `INSERT INTO visits
           (user_id, customer_id, area, layout, location_link,
            site_stage, feedback, visit_date, visit_time,
            notes, image_url, customer_type, custom_customer_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          agentId,
          customerId,
          v.area,
          v.layout ?? null,
          v.locationLink,
          v.siteStage,
          v.feedback,
          visitDate,
          v.time,
          v.notes,
          "/api/uploads/placeholder.jpg",
          v.customerType,
          v.customerType === "Others" ? (v.customCustomerType ?? null) : null,
        ],
      );

      const visitId = r.rows[0].id;
      visitIds.push(visitId);

      // Insert standard brands
      for (const brandName of v.brands) {
        const brandId = brandIdMap[brandName];
        if (!brandId) {
          console.warn(`    ! Brand "${brandName}" not found — skipping`);
          continue;
        }
        await client.query(
          `INSERT INTO visit_brands (visit_id, brand_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [visitId, brandId],
        );
      }

      // Insert custom brand (if any)
      if (v.customBrand) {
        await client.query(
          `INSERT INTO visit_brands (visit_id, custom_brand_name)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [visitId, v.customBrand],
        );
      }

      const label = CUSTOMERS[v.custIdx].name;
      const agent = AGENTS[v.agentIdx].name;
      console.log(`  + Visit ${i + 1}: ${label} — ${v.siteStage} (${visitDate}) by ${agent}`);
    }

    // ── 5. Follow-ups ────────────────────────────────────────────────────────
    console.log("\nInserting follow-ups...");

    for (const f of FOLLOWUPS) {
      const visitId = visitIds[f.visitIdx];

      if (f.status === "Converted") {
        await client.query(
          `INSERT INTO followups
             (visit_id, followup_date, status, notes,
              sale_amount, invoice_number, converted_at)
           VALUES ($1,$2,$3,$4,$5,$6,NOW())`,
          [visitId, f.date, "Converted", f.notes, f.saleAmount, f.invoiceNumber],
        );
        console.log(`  + Converted — Visit ${f.visitIdx + 1} — ₹${Number(f.saleAmount).toLocaleString("en-IN")} — ${f.invoiceNumber}`);

      } else if (f.status === "Completed") {
        await client.query(
          `INSERT INTO followups
             (visit_id, followup_date, status, notes,
              summary, spoke_to_customer, quotation_sent, quotation_number)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            visitId, f.date, "Completed", f.notes,
            f.summary, f.spoke, f.quotationSent,
            f.quotationSent ? (f.quotationNumber ?? null) : null,
          ],
        );
        console.log(`  + Completed — Visit ${f.visitIdx + 1} — Spoke: ${f.spoke} — Quote sent: ${f.quotationSent}`);

      } else {
        // Pending
        await client.query(
          `INSERT INTO followups (visit_id, followup_date, status, notes)
           VALUES ($1,$2,$3,$4)`,
          [visitId, f.date, "Pending", f.notes ?? null],
        );
        console.log(`  + Pending — Visit ${f.visitIdx + 1} — Due: ${f.date}`);
      }
    }

    await client.query("COMMIT");

    // ── Summary ──────────────────────────────────────────────────────────────
    const counts = await client.query(`
      SELECT
        (SELECT count(*) FROM users    WHERE role != 'manager') AS agents,
        (SELECT count(*) FROM customers)                        AS customers,
        (SELECT count(*) FROM visits)                           AS visits,
        (SELECT count(*) FROM followups)                        AS followups,
        (SELECT count(*) FROM followups WHERE status='Converted') AS conversions,
        (SELECT count(*) FROM followups WHERE status='Completed') AS completed,
        (SELECT count(*) FROM followups WHERE status='Pending')   AS pending,
        (SELECT coalesce(sum(sale_amount),0) FROM followups WHERE status='Converted') AS total_sales
    `);
    const s = counts.rows[0];

    console.log(`
╔══════════════════════════════════════════╗
║          SEED COMPLETE — SUMMARY         ║
╠══════════════════════════════════════════╣
║  Agents      : ${String(s.agents).padEnd(26)}║
║  Customers   : ${String(s.customers).padEnd(26)}║
║  Visits      : ${String(s.visits).padEnd(26)}║
║  Follow-ups  : ${String(s.followups).padEnd(26)}║
║    Converted : ${String(s.conversions).padEnd(26)}║
║    Completed : ${String(s.completed).padEnd(26)}║
║    Pending   : ${String(s.pending).padEnd(26)}║
║  Total Sales : ₹${String(Number(s.total_sales).toLocaleString("en-IN")).padEnd(25)}║
╚══════════════════════════════════════════╝

  Agent Logins (both use password: Agent@123)
  ─────────────────────────────────────────
  User ID: agent01  →  Ravi Kumar
  User ID: agent02  →  Priya Sharma
`);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n✗ Seed failed — all changes rolled back.");
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
