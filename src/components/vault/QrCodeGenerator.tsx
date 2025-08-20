// FILE: src/components/vault/QrCodeGenerator.tsx

import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { Label } from '@/components/ui/label'; // CORRECTED: Added this import

interface QrCodeGeneratorProps {
  assetId: string;
  assetName: string;
}

export const QrCodeGenerator: React.FC<QrCodeGeneratorProps> = ({ assetId, assetName }) => {
  // Construct the full, public URL for the certificate page
  const certificateUrl = `${window.location.origin}/certificate/${assetId}`;

  const handlePrint = () => {
    const qrCanvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
    if (!qrCanvas) return;

    const qrImage = qrCanvas.toDataURL('image/png');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Asset Label</title>
            <style>
              @media print {
                @page { size: 4in 2in; margin: 0.1in; }
                body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; }
                .label-container { display: flex; align-items: center; gap: 16px; width: 100%; height: 100%; border: 1px solid #ccc; padding: 8px; box-sizing: border-box; }
                .qr-code { width: 128px; height: 128px; }
                .info { display: flex; flex-direction: column; justify-content: center; }
                .asset-name { font-size: 16px; font-weight: bold; margin: 0; }
                .asset-id { font-size: 10px; color: #666; margin: 4px 0 0 0; }
              }
            </style>
          </head>
          <body>
            <div class="label-container">
              <img src="${qrImage}" class="qr-code" />
              <div class="info">
                 <p class="asset-name">${assetName}</p>
                 <p class="asset-id">ID: ${assetId}</p>
              </div>
            </div>
            <script>
              window.onload = function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                }
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };


  return (
    <div className="space-y-4 pt-4 border-t">
        <Label>Physical Asset Tag</Label>
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="p-2 bg-white rounded-md">
                <QRCodeCanvas id="qr-code-canvas" value={certificateUrl} size={128} />
            </div>
            <div className="flex-1 text-center sm:text-left">
                <p className="text-sm text-muted-foreground">
                    Scan this code to view the public asset certificate. Print it as a label to attach to your physical item.
                </p>
                <Button onClick={handlePrint} className="mt-4 w-full sm:w-auto">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Label
                </Button>
            </div>
        </div>
    </div>
  );
};
