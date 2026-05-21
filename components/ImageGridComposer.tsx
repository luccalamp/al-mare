"use client";

import NextImage from "next/image";
import { useState, useRef, ChangeEvent } from "react";
import { Download, Image as ImageIcon, Upload, Trash2 } from "lucide-react";

interface ImageGridComposerProps {
  title: string;
  subtitle?: string;
  labels: [string, string, string, string];
}

export default function ImageGridComposer({ title, subtitle, labels }: ImageGridComposerProps) {
  const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const handleFileChange = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        setImages((prev) => {
          const next = [...prev];
          next[index] = result;
          return next;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setCompositeUrl(null);
  };

  const generateComposite = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Define a standard size for the quadrants
    const quadWidth = 600;
    const quadHeight = 600;
    
    canvas.width = quadWidth * 2;
    canvas.height = quadHeight * 2;

    // Fill background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const positions = [
      { x: 0, y: 0 },
      { x: quadWidth, y: 0 },
      { x: 0, y: quadHeight },
      { x: quadWidth, y: quadHeight },
    ];

    let loadedCount = 0;
    const imagesToLoad = images.filter(img => img !== null).length;

    if (imagesToLoad === 0) {
      alert("Adicione pelo menos uma imagem.");
      return;
    }

    images.forEach((src, index) => {
      if (src) {
        const img = new Image();
        img.onload = () => {
          // Draw image to cover quadrant
          const scale = Math.max(quadWidth / img.width, quadHeight / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const dx = positions[index].x + (quadWidth - drawW) / 2;
          const dy = positions[index].y + (quadHeight - drawH) / 2;

          ctx.save();
          ctx.beginPath();
          ctx.rect(positions[index].x, positions[index].y, quadWidth, quadHeight);
          ctx.clip();
          ctx.drawImage(img, dx, dy, drawW, drawH);
          
          // Draw label
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.fillRect(positions[index].x, positions[index].y + quadHeight - 40, quadWidth, 40);
          ctx.fillStyle = "#ffffff";
          ctx.font = "20px sans-serif";
          ctx.fillText(labels[index], positions[index].x + 20, positions[index].y + quadHeight - 15);
          ctx.restore();

          loadedCount++;
          if (loadedCount === imagesToLoad) {
            // Add grid lines
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(quadWidth, 0);
            ctx.lineTo(quadWidth, canvas.height);
            ctx.moveTo(0, quadHeight);
            ctx.lineTo(canvas.width, quadHeight);
            ctx.stroke();

            setCompositeUrl(canvas.toDataURL("image/jpeg", 0.9));
          }
        };
        img.src = src;
      }
    });
  };

  const handleDownload = () => {
    if (compositeUrl) {
      const link = document.createElement("a");
      link.href = compositeUrl;
      link.download = `${title.toLowerCase().replace(/\s+/g, "_")}.jpg`;
      link.click();
    }
  };

  return (
    <div className="space-y-4 rounded-[24px] border border-[var(--color-brand-line)] bg-white/70 p-5 shadow-[0_12px_30px_rgba(94,58,28,0.06)]">
      <div>
        <h4 className="text-sm font-semibold text-[var(--color-text)]">{title}</h4>
        {subtitle && <p className="text-xs text-[var(--color-text-secondary)]">{subtitle}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {labels.map((label, index) => (
          <div key={index} className="flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-brand-accent)]">
              {label}
            </span>
            <div className="group relative aspect-square overflow-hidden rounded-[16px] border border-dashed border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] transition-colors hover:border-[var(--color-brand-deep)]">
              {images[index] ? (
                <>
                  <NextImage
                    src={images[index]!}
                    alt={label}
                    fill
                    unoptimized
                    sizes="(min-width: 640px) 12rem, 45vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => removeImage(index)}
                      className="rounded-full bg-red-500 p-2 text-white transition-transform hover:scale-110"
                      title="Remover imagem"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => fileInputRefs[index].current?.click()}
                  className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-brand-deep)]"
                >
                  <Upload size={20} />
                  <span className="text-xs font-medium">Adicionar foto</span>
                </button>
              )}
              <input
                ref={fileInputRefs[index]}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange(index)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          onClick={generateComposite}
          disabled={images.every(img => img === null)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-deep)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-deep)]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImageIcon size={16} /> Gerar Mosaico
        </button>

        {compositeUrl && (
          <button
            onClick={handleDownload}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)]"
          >
            <Download size={16} /> Exportar
          </button>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {compositeUrl && (
        <div className="mt-4 overflow-hidden rounded-[20px] border border-[var(--color-brand-line)] bg-white">
          <div className="border-b border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--color-brand-accent)]">
              Resultado Final
            </span>
          </div>
          <div className="relative aspect-square w-full">
            <NextImage
              src={compositeUrl}
              alt="Mosaico gerado"
              fill
              unoptimized
              sizes="(min-width: 1024px) 32rem, 100vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
