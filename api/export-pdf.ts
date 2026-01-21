// FILE: src/pages/api/vault/export-pdf.ts
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

interface VaultItem {
  id: string;
  asset_name: string;
  valuation_data: {
    decision: string;
    estimatedValue: string;
    confidence: string;
    reasoning: string;
    comps: any[];
    grade?: string;
  } | null;
  photos: string[] | null;
  notes: string | null;
  serial_number: string | null;
  receipt_url: string | null;
  owner_valuation: number | null;
  provenance_documents: string[] | null;
  created_at: string;
}

interface ExportOptions {
  includePhotos: boolean;
  includeValuations: boolean;
  includeNotes: boolean;
  includeProvenance: boolean;
  format: 'detailed' | 'summary' | 'insurance';
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.split(' ')[1];
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse request body
    const { items, vaultName, options } = await request.json() as {
      items: VaultItem[];
      vaultName: string;
      options: ExportOptions;
    };

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ error: 'No items provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate PDF
    const pdfBuffer = await generatePDF(items, vaultName, options, user.email || 'Unknown');

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${vaultName.replace(/\s+/g, '_')}_Report.pdf"`
      }
    });

  } catch (error) {
    console.error('PDF export error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate PDF' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function generatePDF(
  items: VaultItem[],
  vaultName: string,
  options: ExportOptions,
  userEmail: string
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `${vaultName} - Vault Report`,
          Author: 'TagnetIQ Vault',
          Subject: 'Vault Item Report',
          Creator: 'TagnetIQ'
        }
      });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Calculate totals
      const totalValue = items.reduce((sum, item) => {
        const val = item.valuation_data?.estimatedValue;
        if (val) {
          const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
          return sum + (isNaN(num) ? 0 : num);
        }
        return sum;
      }, 0);

      // === COVER PAGE ===
      doc.fontSize(28).font('Helvetica-Bold').text('VAULT REPORT', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(18).font('Helvetica').text(vaultName, { align: 'center' });
      doc.moveDown(2);

      // Report info box
      doc.rect(50, doc.y, 512, 100).stroke();
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`, 60);
      doc.text(`Owner: ${userEmail}`, 60);
      doc.text(`Total Items: ${items.length}`, 60);
      doc.text(`Total Estimated Value: $${totalValue.toLocaleString()}`, 60);
      doc.text(`Report Type: ${options.format.charAt(0).toUpperCase() + options.format.slice(1)}`, 60);

      doc.moveDown(3);

      // Disclaimer
      doc.fontSize(9).fillColor('#666666');
      doc.text('DISCLAIMER: This report is generated for informational purposes only. Valuations are AI-estimated and should not be considered professional appraisals. For insurance or legal purposes, please consult a certified appraiser.', {
        align: 'center',
        width: 450
      });
      doc.fillColor('#000000');

      // === TABLE OF CONTENTS (for detailed reports) ===
      if (options.format === 'detailed' && items.length > 3) {
        doc.addPage();
        doc.fontSize(18).font('Helvetica-Bold').text('Table of Contents');
        doc.moveDown();
        doc.fontSize(11).font('Helvetica');
        
        items.forEach((item, index) => {
          doc.text(`${index + 1}. ${item.asset_name}`, {
            continued: true
          });
          doc.text(`  ${item.valuation_data?.estimatedValue || 'No valuation'}`, {
            align: 'right'
          });
        });
      }

      // === ITEM PAGES ===
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        doc.addPage();

        // Item header
        doc.fontSize(16).font('Helvetica-Bold').text(item.asset_name);
        doc.moveDown(0.3);
        
        // Item metadata bar
        doc.fontSize(9).fillColor('#666666');
        doc.text(`Item ${i + 1} of ${items.length} | Added: ${new Date(item.created_at).toLocaleDateString()}`);
        doc.fillColor('#000000');
        doc.moveDown();

        // Valuation section
        if (options.includeValuations && item.valuation_data) {
          doc.rect(50, doc.y, 512, 80).fillAndStroke('#f8f9fa', '#dee2e6');
          const boxY = doc.y + 10;
          
          doc.fillColor('#000000');
          doc.fontSize(12).font('Helvetica-Bold').text('Valuation', 60, boxY);
          doc.fontSize(22).text(item.valuation_data.estimatedValue || 'N/A', 60, boxY + 18);
          
          doc.fontSize(10).font('Helvetica');
          doc.text(`Confidence: ${item.valuation_data.confidence || 'N/A'}`, 250, boxY);
          doc.text(`Grade: ${item.valuation_data.grade || 'N/A'}`, 250, boxY + 15);
          doc.text(`Decision: ${item.valuation_data.decision || 'N/A'}`, 250, boxY + 30);

          if (item.owner_valuation) {
            doc.text(`Owner Valuation: $${item.owner_valuation.toLocaleString()}`, 400, boxY);
          }

          doc.y = boxY + 70;
          doc.moveDown();
        }

        // Serial number
        if (options.includeNotes && item.serial_number) {
          doc.fontSize(10).font('Helvetica-Bold').text('Serial Number: ', { continued: true });
          doc.font('Helvetica').text(item.serial_number);
          doc.moveDown(0.5);
        }

        // Notes
        if (options.includeNotes && item.notes) {
          doc.fontSize(10).font('Helvetica-Bold').text('Notes:');
          doc.font('Helvetica').text(item.notes, { width: 500 });
          doc.moveDown();
        }

        // AI Reasoning (for detailed/insurance formats)
        if (options.includeValuations && item.valuation_data?.reasoning && options.format !== 'summary') {
          doc.fontSize(10).font('Helvetica-Bold').text('Analysis:');
          doc.fontSize(9).font('Helvetica').text(item.valuation_data.reasoning, { width: 500 });
          doc.moveDown();
        }

        // Comparable sales (for insurance format)
        if (options.format === 'insurance' && item.valuation_data?.comps?.length > 0) {
          doc.fontSize(10).font('Helvetica-Bold').text('Comparable Sales:');
          doc.fontSize(9).font('Helvetica');
          item.valuation_data.comps.slice(0, 5).forEach((comp: any, idx: number) => {
            doc.text(`${idx + 1}. ${comp.title || comp.name || 'Comparable item'} - ${comp.price || comp.soldPrice || 'N/A'}`);
          });
          doc.moveDown();
        }

        // Photos placeholder (note: actual image embedding would require fetching images)
        if (options.includePhotos && item.photos && item.photos.length > 0) {
          doc.fontSize(10).font('Helvetica-Bold').text('Photos:');
          doc.fontSize(9).font('Helvetica');
          doc.text(`${item.photos.length} photo(s) on file`);
          item.photos.forEach((url, idx) => {
            doc.fontSize(8).fillColor('#0066cc').text(`Photo ${idx + 1}: ${url}`, { link: url });
          });
          doc.fillColor('#000000');
          doc.moveDown();
        }

        // Provenance
        if (options.includeProvenance && item.provenance_documents && item.provenance_documents.length > 0) {
          doc.fontSize(10).font('Helvetica-Bold').text('Provenance Documents:');
          doc.fontSize(9).font('Helvetica');
          doc.text(`${item.provenance_documents.length} document(s) on file`);
          doc.moveDown();
        }

        // Receipt
        if (item.receipt_url) {
          doc.fontSize(10).font('Helvetica-Bold').text('Receipt: ', { continued: true });
          doc.font('Helvetica').fillColor('#0066cc').text('View Receipt', { link: item.receipt_url });
          doc.fillColor('#000000');
        }
      }

      // === SUMMARY PAGE ===
      doc.addPage();
      doc.fontSize(18).font('Helvetica-Bold').text('Summary');
      doc.moveDown();

      // Summary table
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Item', 50, doc.y, { width: 250, continued: false });
      doc.text('Value', 350, doc.y - 12);
      
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.3);

      doc.font('Helvetica');
      items.forEach((item) => {
        const y = doc.y;
        doc.text(item.asset_name.substring(0, 50), 50, y, { width: 280 });
        doc.text(item.valuation_data?.estimatedValue || 'N/A', 350, y);
        doc.moveDown(0.5);
      });

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
      doc.moveDown(0.3);
      
      doc.font('Helvetica-Bold');
      doc.text('Total Estimated Value:', 50);
      doc.text(`$${totalValue.toLocaleString()}`, 350, doc.y - 12);

      // Footer
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#999999');
        doc.text(
          `Generated by TagnetIQ Vault | Page ${i + 1} of ${pageCount}`,
          50,
          doc.page.height - 30,
          { align: 'center', width: doc.page.width - 100 }
        );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}