// ============================================================
// FILE:  src/components/analysis/components/RefineDialog.tsx
// ============================================================
// Dialog for refining analysis with additional context + visual evidence.
//
// v1.0: Text-only refinement
// v2.0: Photo evidence added
//   - Camera capture (mobile, capture="environment") + file picker
//   - On-device JPEG compression via canvas before base64 encoding
//     (mobile-first: server never receives raw 8MB phone photos)
//   - Up to 4 additional images alongside the text correction
//   - Visual evidence is passed to all 3 vision AI providers
//   - The 1978 copyright stamp / PSA label / brand marking can now be
//     shown directly to HYDRA instead of described in words
//
// v2.1 — Mobile camera fix:
//   BUG: On Android Chrome, combining capture="environment" + multiple
//   on the same <input> causes the browser to silently drop the capture
//   attribute and open the file picker instead of the camera. This is a
//   known Android WebView/Chrome bug — multiple signals "I want many files"
//   which conflicts with the single-shot camera flow.
//
//   FIX: Two completely separate hidden inputs:
//     cameraInputRef  — capture="environment", NO multiple (single shot)
//     fileInputRef    — multiple, NO capture (file picker, multi-select)
//
//   The "Take Photo" button triggers cameraInputRef. After each capture
//   the input value is cleared so the same shot can be retaken if needed.
//   Users wanting multiple camera shots tap the button again — matches
//   native mobile camera UX exactly.
//
//   "Choose File" triggers fileInputRef — unchanged, multi-select works.

import React, { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Camera, Upload, X, ImagePlus, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_IMAGES = 4;
// On-device compression target — keeps payloads fast on 3G
const COMPRESS_MAX_WIDTH = 1200;
const COMPRESS_QUALITY = 0.82;

// =============================================================================
// PROPS
// =============================================================================

interface RefineDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  // Text correction
  refinementText: string;
  onTextChange: (text: string) => void;
  // Photo evidence — base64 strings (already compressed on device)
  refinementImages: string[];
  onImagesChange: (images: string[]) => void;
  // Submission
  isSubmitting: boolean;
  onSubmit: () => void;
}

// =============================================================================
// ON-DEVICE JPEG COMPRESSION
// Mobile-first: compress before base64, not after.
// A 12MP phone photo at full quality = ~8MB. At 1200px / 0.82 quality = ~180KB.
// This is the same compression pattern used by the DualScanner.
// =============================================================================

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate target dimensions (preserve aspect ratio)
      let { width, height } = img;
      if (width > COMPRESS_MAX_WIDTH) {
        height = Math.round((height * COMPRESS_MAX_WIDTH) / width);
        width = COMPRESS_MAX_WIDTH;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Extract base64 — strip the data URL prefix
      const dataUrl = canvas.toDataURL('image/jpeg', COMPRESS_QUALITY);
      resolve(dataUrl.split('base64,')[1]);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };

    img.src = url;
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

const RefineDialog: React.FC<RefineDialogProps> = ({
  isOpen,
  onOpenChange,
  refinementText,
  onTextChange,
  refinementImages,
  onImagesChange,
  isSubmitting,
  onSubmit,
}) => {
  // v2.1: Two separate refs — never combine capture + multiple on one input.
  //   cameraInputRef — capture="environment", single shot, no multiple.
  //   fileInputRef   — multiple, no capture, standard file picker.
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [compressing, setCompressing] = React.useState(false);
  const [compressionError, setCompressionError] = React.useState<string | null>(null);

  const canAddMore = refinementImages.length < MAX_IMAGES;
  const hasContent = refinementText.trim().length > 0 || refinementImages.length > 0;

  // ── Image processing ──────────────────────────────────────────────────────

  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCompressionError(null);

    const remaining = MAX_IMAGES - refinementImages.length;
    const toProcess = Array.from(files).slice(0, remaining);

    if (toProcess.length === 0) return;

    setCompressing(true);
    try {
      const compressed = await Promise.all(
        toProcess.map(file => compressImage(file))
      );
      onImagesChange([...refinementImages, ...compressed]);
    } catch (err) {
      setCompressionError('One or more images could not be processed. Try a different photo.');
      console.error('Image compression error:', err);
    } finally {
      setCompressing(false);
      // Reset inputs so the same file can be re-selected if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  }, [refinementImages, onImagesChange]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const removeImage = (index: number) => {
    const updated = refinementImages.filter((_, i) => i !== index);
    onImagesChange(updated);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Refine AI Analysis</DialogTitle>
          <DialogDescription>
            Correct what HYDRA got wrong. Add context, show proof — a copyright date,
            a PSA label, a brand marking. Visual evidence overrides AI assumptions.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">

          {/* ── Text correction ──────────────────────────────────────────── */}
          <div className="grid gap-2">
            <Label htmlFor="refinement-text">
              What's wrong with the analysis?
            </Label>
            <Textarea
              id="refinement-text"
              placeholder={
                "e.g., 'This is the 1978 first print, not a modern reprint. " +
                "Copyright page shows Dec 1978.' or 'PSA 9 grade, not raw.' " +
                "or 'Green Bull ladder, not Green Line.'"
              }
              className="h-28 resize-none text-sm"
              value={refinementText}
              onChange={(e) => onTextChange(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* ── Photo evidence ───────────────────────────────────────────── */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <Label>
                Visual Evidence
                <span className="text-muted-foreground font-normal ml-2 text-xs">
                  optional — up to {MAX_IMAGES} photos
                </span>
              </Label>
              <span className="text-xs text-muted-foreground">
                {refinementImages.length}/{MAX_IMAGES}
              </span>
            </div>

            <p className="text-xs text-muted-foreground -mt-1">
              Show the copyright page, PSA cert, brand label, or any detail that
              proves your correction. All 3 vision AIs will analyze your photos.
            </p>

            {/* ── Hidden inputs — MUST stay separate (v2.1 fix) ────────── */}
            {/*
              CAMERA: capture="environment" with NO multiple.
              Adding multiple to this input breaks camera on Android —
              the browser drops capture and opens the file picker instead.
              Single-shot by design. User taps "Take Photo" again for more.
            */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
              disabled={!canAddMore || isSubmitting}
            />
            {/*
              FILE PICKER: multiple with NO capture.
              Standard multi-select from photo library or file system.
              Completely separate from the camera input above.
            */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={!canAddMore || isSubmitting}
            />

            {/* Add photo buttons */}
            {canAddMore && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 text-xs h-9"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={compressing || isSubmitting}
                >
                  <Camera className="h-3.5 w-3.5" />
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 text-xs h-9"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={compressing || isSubmitting}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Choose File
                </Button>
              </div>
            )}

            {/* Compression in progress */}
            {compressing && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Compressing for fast upload…
              </div>
            )}

            {/* Error */}
            {compressionError && (
              <div className="flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {compressionError}
              </div>
            )}

            {/* Image previews */}
            {refinementImages.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {refinementImages.map((b64, index) => (
                  <div
                    key={index}
                    className="relative rounded-md overflow-hidden border bg-muted aspect-square group"
                  >
                    <img
                      src={`data:image/jpeg;base64,${b64}`}
                      alt={`Evidence ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      disabled={isSubmitting}
                      className="
                        absolute top-1 right-1
                        bg-black/60 hover:bg-black/80
                        text-white rounded-full p-0.5
                        opacity-0 group-hover:opacity-100
                        focus:opacity-100
                        transition-opacity
                        disabled:cursor-not-allowed
                      "
                      aria-label={`Remove image ${index + 1}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    {/* Index badge */}
                    <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] rounded px-1">
                      {index + 1}
                    </div>
                  </div>
                ))}

                {/* Add more slot — opens file picker (not camera) for consistency */}
                {canAddMore && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={compressing || isSubmitting}
                    className="
                      aspect-square rounded-md border-2 border-dashed border-muted-foreground/30
                      hover:border-muted-foreground/60 hover:bg-muted/50
                      flex flex-col items-center justify-center gap-1
                      text-muted-foreground transition-colors
                      disabled:cursor-not-allowed disabled:opacity-50
                    "
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">Add photo</span>
                  </button>
                )}
              </div>
            )}

            {/* Capacity reached notice */}
            {!canAddMore && (
              <p className="text-xs text-muted-foreground">
                Maximum {MAX_IMAGES} evidence photos. Remove one to add another.
              </p>
            )}
          </div>

          {/* ── What happens notice ──────────────────────────────────────── */}
          {(refinementImages.length > 0 || refinementText.trim().length > 0) && (
            <div className="rounded-md bg-muted/50 border px-3 py-2.5 text-xs text-muted-foreground">
              {refinementImages.length > 0 && refinementText.trim().length > 0 ? (
                <>
                  HYDRA will re-analyze using your{' '}
                  <strong className="text-foreground">text correction</strong> and{' '}
                  <strong className="text-foreground">
                    {refinementImages.length} photo{refinementImages.length > 1 ? 's' : ''}
                  </strong>.
                  Visual evidence takes priority over the original scan.
                </>
              ) : refinementImages.length > 0 ? (
                <>
                  HYDRA will re-analyze your{' '}
                  <strong className="text-foreground">
                    {refinementImages.length} evidence photo{refinementImages.length > 1 ? 's' : ''}
                  </strong>.
                  Adding a text description improves accuracy further.
                </>
              ) : (
                <>
                  HYDRA will update the valuation based on your correction.
                  Adding evidence photos makes the result more accurate.
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || !hasContent || compressing}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Re-analyzing…
              </>
            ) : (
              'Submit & Re-Analyze'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RefineDialog;