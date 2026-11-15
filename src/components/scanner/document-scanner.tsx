import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, FileImage, FileText, LoaderCircle, RotateCw, ScanLine, Trash2, X } from "lucide-react";

import { ocrNoticeImages } from "@/lib/ocr-notice";
import { createScannedPdf, type ScannedJpegPage } from "@/lib/scanner/pdf-export";
import { detectPageBounds, type PageBounds } from "@/lib/scanner/auto-crop";

const MAX_PAGES = 6;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
type Page = { id: number; file: File; preview: string; rotation: number; crop: number; bounds: PageBounds | null };

function imageAllowed(file: File): boolean {
  return /^image\/(?:jpeg|png|webp)$/.test(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES;
}

/** Local-only manual trim and rotation; no images leave the browser. */
async function preparePage(page: Page): Promise<File> {
  const img = new Image();
  img.src = page.preview;
  await img.decode();
  const margin = page.crop / 100;
  const sx = Math.round(img.naturalWidth * ((page.bounds?.left ?? 0) / 100 + margin));
  const sy = Math.round(img.naturalHeight * ((page.bounds?.top ?? 0) / 100 + margin));
  const right = Math.round(img.naturalWidth * ((page.bounds?.right ?? 0) / 100 + margin));
  const bottom = Math.round(img.naturalHeight * ((page.bounds?.bottom ?? 0) / 100 + margin));
  const sw = img.naturalWidth - sx - right;
  const sh = img.naturalHeight - sy - bottom;
  if (sw < 100 || sh < 100) throw new Error("Too much of the page was cropped.");
  const quarterTurn = page.rotation % 180 !== 0;
  const canvas = document.createElement("canvas");
  canvas.width = quarterTurn ? sh : sw;
  canvas.height = quarterTurn ? sw : sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is unavailable.");
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((page.rotation * Math.PI) / 180);
  ctx.drawImage(img, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("The scan could not be prepared.")), "image/jpeg", 0.92)
  );
  return new File([blob], `truth-weaver-scan-${page.id}.jpg`, { type: "image/jpeg" });
}

export function DocumentScanner({ onText }: { onText: (text: string, pageCount: number) => void }) {
  const [open, setOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewsRef = useRef<Set<string>>(new Set());
  const nextId = useRef(1);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    async function openCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Live camera preview is unavailable. Use Take photo / Choose pages below.");
        return;
      }
      let acquired: MediaStream | null = null;
      try {
        acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { acquired.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = acquired;
        const video = videoRef.current;
        if (!video) throw new Error("The camera preview is unavailable.");
        video.srcObject = acquired;
        await video.play();
        if (stopped) { acquired.getTracks().forEach((track) => track.stop()); return; }
        setCameraReady(true);
      } catch {
        // A successful permission grant can still be followed by playback failure.
        // Never leave the camera recording behind an unusable preview.
        acquired?.getTracks().forEach((track) => track.stop());
        if (streamRef.current === acquired) streamRef.current = null;
        if (videoRef.current?.srcObject === acquired) videoRef.current.srcObject = null;
        if (!stopped) {
          setCameraReady(false);
          setCameraError("Camera permission was not granted or preview is unavailable. You can still take a photo or choose pages.");
        }
      }
    }
    void openCamera();
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewsRef.current.clear();
  }, []);

  function addFiles(files: File[]) {
    setError("");
    const valid = files.filter(imageAllowed);
    if (valid.length !== files.length) {
      setError("Use JPG, PNG or WebP images, each 8 MB or smaller.");
    }
    const remaining = Math.max(0, MAX_PAGES - pages.length);
    if (valid.length > remaining) setError(`A document scan may contain up to ${MAX_PAGES} pages.`);
    // Allocate previews outside React state-updater callbacks. React Strict Mode
    // may repeat updater calls, which must not create object URLs or side effects.
    const appended = valid.slice(0, remaining).map((file): Page => {
      const preview = URL.createObjectURL(file);
      previewsRef.current.add(preview);
      return { id: nextId.current++, file, preview, rotation: 0, crop: 0, bounds: null };
    });
    setPages((previous) => [...previous, ...appended]);
  }

  async function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setError("Camera is not ready. Try Take photo / Choose pages.");
      return;
    }
    const scale = Math.min(1, 1800 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not capture page.")), "image/jpeg", 0.92)
      );
      addFiles([new File([blob], `page-${nextId.current}.jpg`, { type: "image/jpeg" })]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not capture page.");
    }
  }

  function remove(id: number) {
    const page = pages.find((candidate) => candidate.id === id);
    if (page) {
      URL.revokeObjectURL(page.preview);
      previewsRef.current.delete(page.preview);
    }
    setPages((previous) => previous.filter((candidate) => candidate.id !== id));
  }

  function reset() {
    setOpen(false);
    previewsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewsRef.current.clear();
    setPages([]);
    setProgress("");
    setError("");
    setCameraError("");
    setCameraReady(false);
  }

  async function autoFindEdges(id: number, preview: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const bounds = await detectPageBounds(preview);
      if (!bounds) {
        setProgress("No clear rectangular page edge found. You can use manual trim instead.");
      } else {
        setPages((items) => items.map((item) =>
          item.id === id ? { ...item, bounds, crop: 0 } : item));
        setProgress("Suggested document edges were applied. Review the preview before reading or saving.");
      }
    } catch {
      setError("Page edges could not be detected. Manual trim still works.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    if (busy || pages.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const scanned: ScannedJpegPage[] = [];
      for (let i = 0; i < pages.length; i++) {
        setProgress(`Preparing PDF page ${i + 1} of ${pages.length} locally…`);
        const jpegFile = await preparePage(pages[i]!);
        const bitmap = await createImageBitmap(jpegFile);
        scanned.push({
          jpeg: new Uint8Array(await jpegFile.arrayBuffer()),
          width: bitmap.width,
          height: bitmap.height,
        });
        bitmap.close();
      }
      const pdf = createScannedPdf(scanned);
      const downloadUrl = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "truth-weaver-scanned-document.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      // Give the browser sufficient time to take ownership of the download.
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
      setProgress("PDF saved from the pages on your device. No upload occurred.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not export a PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function readPages() {
    if (busy || pages.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const prepared: File[] = [];
      for (let i = 0; i < pages.length; i++) {
        setProgress(`Preparing page ${i + 1} of ${pages.length} on this device…`);
        prepared.push(await preparePage(pages[i]!));
      }
      const result = await ocrNoticeImages(prepared, setProgress);
      onText(result.text, pages.length);
      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The pages could not be read. Try a clearer photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="document-scanner" data-testid="document-scanner" className="rounded-2xl border border-gold/30 bg-forest-deep/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-serif text-xl text-parchment"><ScanLine className="h-5 w-5 text-gold" /> Document scanner</h3>
          <p className="mt-1 max-w-lg text-xs leading-5 text-parchment/70">
            Use your camera to capture up to six pages. Suggest page edges, rotate and manually trim, save a PDF locally, or read text privately on your device.
            No scan is uploaded automatically.
          </p>
        </div>
        <button type="button" data-testid="open-document-scanner" onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/20">
          <Camera className="h-4 w-4" /> Open scanner
        </button>
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="Document scanner" data-testid="document-scanner-dialog"
          className="fixed inset-0 z-[100] overflow-y-auto bg-ink/95 p-4 text-parchment sm:p-8">
          <div className="mx-auto max-w-3xl rounded-2xl border border-gold/30 bg-forest-deep p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl">Scan document</h2>
              <button type="button" onClick={reset} disabled={busy} aria-label="Close document scanner" className="rounded-full p-2 hover:bg-white/10"><X /></button>
            </div>
            <p className="mt-2 text-sm text-parchment/70">
              Place the document inside the frame. You control which pages to keep and when to send reviewed text for analysis.
            </p>
            <div className="relative mt-4 overflow-hidden rounded-xl border border-gold/30 bg-black">
              <video ref={videoRef} playsInline muted autoPlay aria-label="Live document camera" className="aspect-[4/3] w-full object-contain" />
              <div aria-hidden className="pointer-events-none absolute inset-[8%] rounded-xl border-2 border-dashed border-gold/60" />
            </div>
            {cameraError && <p role="status" className="mt-3 text-xs text-warn">{cameraError}</p>}
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => void capture()} disabled={busy || pages.length >= MAX_PAGES || !cameraReady}
                className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50">
                <Camera className="h-4 w-4" /> Capture page
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm text-gold">
                <FileImage className="h-4 w-4" /> Take photo / Choose pages
                <input data-testid="scanner-photo-input" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    addFiles(Array.from(e.currentTarget.files ?? []));
                    e.currentTarget.value = "";
                  }}
                  disabled={busy || pages.length >= MAX_PAGES} className="sr-only" />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm text-gold">
                <FileImage className="h-4 w-4" /> Choose multiple pages
                <input data-testid="scanner-pages-input" type="file" accept="image/jpeg,image/png,image/webp" multiple
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    addFiles(Array.from(e.currentTarget.files ?? []));
                    e.currentTarget.value = "";
                  }}
                  disabled={busy || pages.length >= MAX_PAGES} className="sr-only" />
              </label>
            </div>
            <h3 className="mt-6 font-serif text-lg">Pages ({pages.length}/{MAX_PAGES})</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {pages.map((page, index) => (
                <div key={page.id} className="rounded-xl border border-gold/20 bg-ink/60 p-3" data-testid="scanner-page">
                  <div className="flex items-center justify-between gap-2 text-xs text-parchment/70">
                    <span>Page {index + 1}</span>
                    <button type="button" aria-label={`Remove page ${index + 1}`} onClick={() => remove(page.id)} disabled={busy} className="text-warn hover:underline"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2 grid h-40 place-items-center overflow-hidden rounded-lg bg-black/70">
                    <img alt={`Scanned page ${index + 1} preview`} src={page.preview}
                      style={{
                        transform: `rotate(${page.rotation}deg)`,
                        clipPath: `inset(${(page.bounds?.top ?? 0) + page.crop}% ${(page.bounds?.right ?? 0) + page.crop}% ${(page.bounds?.bottom ?? 0) + page.crop}% ${(page.bounds?.left ?? 0) + page.crop}%)`,
                      }}
                      className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <button type="button" disabled={busy} onClick={() => void autoFindEdges(page.id, page.preview)}
                      aria-label={`Suggest edges for page ${index + 1}`}
                      className="inline-flex items-center gap-1 text-xs text-gold">
                      <ScanLine className="h-4 w-4" /> Suggest page edges
                    </button>
                    {page.bounds && (
                      <button type="button" disabled={busy}
                        onClick={() => setPages((items) => items.map((item) => item.id === page.id ? { ...item, bounds: null } : item))}
                        aria-label={`Clear suggested edges for page ${index + 1}`}
                        className="text-xs text-parchment/75 underline">Clear suggestion</button>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <button type="button" disabled={busy} onClick={() => setPages((items) => items.map((item) => item.id === page.id ? { ...item, rotation: (item.rotation + 90) % 360 } : item))}
                      className="inline-flex items-center gap-1 text-xs text-gold"><RotateCw className="h-4 w-4" /> Rotate</button>
                    <label className="flex flex-1 items-center gap-2 text-xs">
                      Trim edges <input type="range" min="0" max="20" value={page.crop} disabled={busy}
                        aria-label={`Trim edges of page ${index + 1}`}
                        onChange={(e) => {
                          const cropValue = Number(e.currentTarget.value);
                          setPages((items) => items.map((item) => item.id === page.id ? { ...item, crop: cropValue } : item));
                        }}
                        className="min-w-0 flex-1 accent-gold" />
                      {page.crop}%
                    </label>
                  </div>
                </div>
              ))}
            </div>
            {progress && <p role="status" className="mt-4 text-xs text-gold">{progress}</p>}
            {error && <p role="alert" className="mt-4 text-xs text-warn">{error}</p>}
            <div className="mt-5 flex flex-wrap justify-between gap-3">
              <button type="button" data-testid="scanner-discard-scans" aria-label="Discard scans" onClick={reset} disabled={busy} className="rounded-full border border-gold/30 px-4 py-2 text-sm">Discard scans</button>
              <button type="button" onClick={() => void downloadPdf()} disabled={busy || pages.length === 0}
                data-testid="scanner-save-pdf"
                className="inline-flex items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm font-semibold text-gold disabled:opacity-50">
                <FileText className="h-4 w-4" /> Save PDF locally
              </button>
              <button type="button" onClick={() => void readPages()} disabled={busy || pages.length === 0}
                data-testid="scanner-read-pages"
                className="inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-ink disabled:opacity-50">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {busy ? "Reading locally…" : "Read pages into analyzer"}
              </button>
            </div>
            <p className="mt-4 text-xs leading-5 text-parchment/60">
              OCR may misread names, dates and amounts. Check against the original. Reading pages does not submit anything to the analysis server.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
