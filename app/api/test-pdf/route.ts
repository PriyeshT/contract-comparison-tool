// Specify Node.js runtime
export const runtime = 'nodejs'

import { parsePDF } from '@/lib/pdf-parser'

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ success: false, error: 'No file uploaded' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await parsePDF(buffer);

    return new Response(JSON.stringify({ success: true, pdfParseResult: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}