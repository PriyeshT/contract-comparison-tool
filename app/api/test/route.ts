import type { NextApiRequest, NextApiResponse } from 'next';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();

    // Add a page (A4 size)
    const page = pdfDoc.addPage([595.28, 841.89]);

    // Load a standard font
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

    // Add text
    page.drawText('Hello from Next.js! This is a generated PDF.', {
      x: 50,
      y: 750,
      size: 24,
      font,
      color: rgb(0, 0, 0),
    });

    // Save the PDF as bytes
    const pdfBytes = await pdfDoc.save();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="generated.pdf"');
    res.status(200).send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('PDF generation failed:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
}
