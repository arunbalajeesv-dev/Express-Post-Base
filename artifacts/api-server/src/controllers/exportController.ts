import type { RequestHandler } from "express";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import * as exportModel from "../models/exportModel";

const COLUMNS = [
  { header: "Visit ID",       key: "visitId",        width: 10 },
  { header: "Date",           key: "visitDate",       width: 14 },
  { header: "Time",           key: "visitTime",       width: 10 },
  { header: "Customer Name",  key: "customerName",    width: 20 },
  { header: "Mobile",         key: "customerMobile",  width: 14 },
  { header: "Company",        key: "companyName",     width: 22 },
  { header: "Area",           key: "area",            width: 16 },
  { header: "Site Stage",     key: "siteStage",       width: 16 },
  { header: "Feedback",       key: "feedback",        width: 16 },
  { header: "Sales Person",   key: "salesPerson",     width: 18 },
  { header: "Invoice No.",    key: "invoiceNumber",   width: 16 },
  { header: "Sale Amount",    key: "saleAmount",      width: 14 },
  { header: "Notes",          key: "notes",           width: 30 },
];

export const exportExcel: RequestHandler = async (_req, res) => {
  const rows = await exportModel.getAllVisitsForExport();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sales Tracker";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Visits");
  sheet.columns = COLUMNS;

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4E79" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;

  for (const row of rows) {
    const added = sheet.addRow({
      visitId: row.visitId,
      visitDate: row.visitDate,
      visitTime: row.visitTime,
      customerName: row.customerName ?? "",
      customerMobile: row.customerMobile ?? "",
      companyName: row.companyName ?? "",
      area: row.area ?? "",
      siteStage: row.siteStage ?? "",
      feedback: row.feedback ?? "",
      salesPerson: row.salesPerson ?? "",
      invoiceNumber: row.invoiceNumber ?? "",
      saleAmount: row.saleAmount ?? "",
      notes: row.notes ?? "",
    });

    const feedbackCell = added.getCell("feedback");
    const colors: Record<string, string> = {
      Interested: "FF92D050",
      "Not Interested": "FFFF0000",
      Potential: "FFFFC000",
    };
    const color = colors[row.feedback ?? ""] ?? "FFFFFFFF";
    feedbackCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: color },
    };
  }

  sheet.autoFilter = { from: "A1", to: "M1" };

  const filename = `visits_${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  await workbook.xlsx.write(res);
  res.end();
};

export const exportPdf: RequestHandler = async (_req, res) => {
  const rows = await exportModel.getAllVisitsForExport();

  const filename = `visits_report_${new Date().toISOString().slice(0, 10)}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  doc.pipe(res);

  doc
    .fontSize(18)
    .fillColor("#1F4E79")
    .text("Sales Visit Report", { align: "center" });
  doc
    .fontSize(10)
    .fillColor("#555555")
    .text(`Generated: ${new Date().toLocaleString("en-IN")}   |   Total visits: ${rows.length}`, {
      align: "center",
    });
  doc.moveDown(1);

  const colWidths = [30, 55, 45, 110, 80, 110, 65, 70, 70, 95, 80, 65];
  const headers = [
    "ID",
    "Date",
    "Time",
    "Customer",
    "Mobile",
    "Company",
    "Area",
    "Stage",
    "Feedback",
    "Sales Person",
    "Invoice No.",
    "Sale Amt.",
  ];

  const tableLeft = 40;
  const rowHeight = 20;
  const headerHeight = 22;

  function drawRow(
    yPos: number,
    cells: string[],
    isHeader = false,
    feedbackVal = "",
  ) {
    let x = tableLeft;

    if (isHeader) {
      doc.rect(tableLeft, yPos, colWidths.reduce((a, b) => a + b, 0), headerHeight)
        .fill("#1F4E79");
    } else {
      const feedbackColors: Record<string, string> = {
        Interested: "#E2EFDA",
        "Not Interested": "#FFDCE1",
        Potential: "#FFF2CC",
      };
      const bg = feedbackColors[feedbackVal] ?? "#FFFFFF";
      doc.rect(tableLeft, yPos, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill(bg);
    }

    doc.fillColor(isHeader ? "#FFFFFF" : "#000000").fontSize(isHeader ? 9 : 8);

    for (let i = 0; i < cells.length; i++) {
      const colW = colWidths[i] ?? 60;
      const text = cells[i] ?? "";
      doc.text(text, x + 3, yPos + (isHeader ? 7 : 6), {
        width: colW - 6,
        ellipsis: true,
        lineBreak: false,
      });
      doc.rect(x, yPos, colW, isHeader ? headerHeight : rowHeight).stroke("#CCCCCC");
      x += colW;
    }
  }

  let y = doc.y;

  drawRow(y, headers, true);
  y += headerHeight;

  for (const row of rows) {
    if (y + rowHeight > doc.page.height - 60) {
      doc.addPage({ layout: "landscape" });
      y = 40;
      drawRow(y, headers, true);
      y += headerHeight;
    }

    drawRow(
      y,
      [
        String(row.visitId),
        row.visitDate ?? "",
        (row.visitTime ?? "").slice(0, 5),
        row.customerName ?? "",
        row.customerMobile ?? "",
        row.companyName ?? "",
        row.area ?? "",
        row.siteStage ?? "",
        row.feedback ?? "",
        row.salesPerson ?? "",
        row.invoiceNumber ?? "",
        row.saleAmount ?? "",
      ],
      false,
      row.feedback ?? "",
    );
    y += rowHeight;
  }

  doc.end();
};
