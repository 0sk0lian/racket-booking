/**
 * PDF invoice generator using pdf-lib.
 * Generates a simple, professional invoice for membership payments.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface InvoiceData {
  invoiceNumber: string;
  date: string;
  dueDate: string;
  // Seller (club)
  clubName: string;
  clubOrgNumber?: string;
  clubEmail?: string;
  clubPhone?: string;
  clubCity?: string;
  // Buyer (member)
  memberName: string;
  memberEmail: string;
  // Line items
  items: { description: string; amount: number }[];
  total: number;
  currency: string;
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const darkText = rgb(0.1, 0.1, 0.15);
  const mutedText = rgb(0.4, 0.45, 0.5);
  const accentColor = rgb(0.39, 0.4, 0.95); // #6366f1

  let y = 790;
  const leftMargin = 50;
  const rightCol = 350;

  // Header
  page.drawText('FAKTURA', { x: leftMargin, y, size: 28, font: fontBold, color: darkText });
  page.drawText(data.invoiceNumber, { x: leftMargin, y: y - 32, size: 12, font, color: mutedText });
  y -= 60;

  // Club info (right side)
  let ry = 790;
  const drawRight = (text: string, bold = false) => {
    const f = bold ? fontBold : font;
    const width = f.widthOfTextAtSize(text, 10);
    page.drawText(text, { x: 545 - width, y: ry, size: 10, font: f, color: darkText });
    ry -= 14;
  };
  drawRight(data.clubName, true);
  if (data.clubOrgNumber) drawRight(`Org.nr: ${data.clubOrgNumber}`);
  if (data.clubCity) drawRight(data.clubCity);
  if (data.clubEmail) drawRight(data.clubEmail);
  if (data.clubPhone) drawRight(data.clubPhone);

  // Dates + customer
  page.drawText('Fakturadatum:', { x: leftMargin, y, size: 10, font, color: mutedText });
  page.drawText(data.date, { x: leftMargin + 90, y, size: 10, font: fontBold, color: darkText });
  y -= 16;
  page.drawText('Förfallodatum:', { x: leftMargin, y, size: 10, font, color: mutedText });
  page.drawText(data.dueDate, { x: leftMargin + 90, y, size: 10, font: fontBold, color: darkText });
  y -= 30;

  page.drawText('Kund:', { x: leftMargin, y, size: 10, font, color: mutedText });
  y -= 16;
  page.drawText(data.memberName, { x: leftMargin, y, size: 11, font: fontBold, color: darkText });
  y -= 14;
  page.drawText(data.memberEmail, { x: leftMargin, y, size: 10, font, color: mutedText });
  y -= 40;

  // Line separator
  page.drawLine({ start: { x: leftMargin, y: y + 10 }, end: { x: 545, y: y + 10 }, thickness: 1, color: rgb(0.9, 0.9, 0.92) });

  // Table header
  page.drawText('Beskrivning', { x: leftMargin, y, size: 10, font: fontBold, color: mutedText });
  page.drawText('Belopp', { x: 480, y, size: 10, font: fontBold, color: mutedText });
  y -= 6;
  page.drawLine({ start: { x: leftMargin, y }, end: { x: 545, y }, thickness: 0.5, color: rgb(0.88, 0.9, 0.92) });
  y -= 18;

  // Line items
  for (const item of data.items) {
    page.drawText(item.description, { x: leftMargin, y, size: 11, font, color: darkText });
    const amountStr = `${item.amount.toFixed(2)} ${data.currency}`;
    const amountWidth = font.widthOfTextAtSize(amountStr, 11);
    page.drawText(amountStr, { x: 545 - amountWidth, y, size: 11, font, color: darkText });
    y -= 22;
  }

  // Total
  y -= 8;
  page.drawLine({ start: { x: 380, y: y + 16 }, end: { x: 545, y: y + 16 }, thickness: 1, color: accentColor });
  page.drawText('Totalt:', { x: 380, y, size: 13, font: fontBold, color: darkText });
  const totalStr = `${data.total.toFixed(2)} ${data.currency}`;
  const totalWidth = fontBold.widthOfTextAtSize(totalStr, 13);
  page.drawText(totalStr, { x: 545 - totalWidth, y, size: 13, font: fontBold, color: accentColor });

  // Footer
  page.drawText('Genererad av Racket Booking', {
    x: leftMargin, y: 40, size: 8, font, color: rgb(0.7, 0.72, 0.75),
  });

  return doc.save();
}
