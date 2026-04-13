"use client";

import type { ReactNode } from "react";
import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { compressImage } from "@/lib/utils/image";

interface PolaroidPhotoProps {
  currentPhotoUrl?: string | null;
  onFileChange?: (file: File | null) => void;
  disabled?: boolean;
  emptyState?: ReactNode;
  emptyLabel?: string;
  footerLabel?: string;
}

export default function PolaroidPhoto({
  currentPhotoUrl,
  onFileChange,
  disabled,
  emptyState,
  emptyLabel = "Adicionar Foto",
  footerLabel,
}: PolaroidPhotoProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhotoUrl || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInteractive = Boolean(onFileChange) && !disabled && !isProcessing;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setIsProcessing(true);
      try {
        const compressedFile = await compressImage(file, 400, 400, 0.85);
        const url = URL.createObjectURL(compressedFile);
        setPreviewUrl(url);
        if (onFileChange) onFileChange(compressedFile);
      } catch (error) {
        console.error("Falha na compressão. Usando arquivo original.", error);
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        if (onFileChange) onFileChange(file);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const removePhoto = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (onFileChange) onFileChange(null);
  };

  return (
    <>
      {/* Target area for hidden input */}
      <div
        onClick={() => isInteractive && fileInputRef.current?.click()}
        className={`relative w-64 h-80 bg-white border-4 border-foreground shadow-editorial flex flex-col p-4 transition-all ${isInteractive ? "cursor-pointer hover:-translate-y-1 hover:shadow-editorial-hover" : ""}`}
      >
        {/* Photo Container (Square Area) */}
        <div className="relative w-full aspect-square bg-[#F0F0F0] border-2 border-foreground overflow-hidden flex items-center justify-center">
          {previewUrl ? (
            <Image 
              src={previewUrl} 
              alt="Preview do Aluno" 
              fill
              unoptimized
              sizes="224px"
              className={`object-cover transition-all ${isProcessing ? "opacity-50 blur-sm grayscale-[80%]" : "grayscale-[20%] hover:grayscale-0"}`}
            />
          ) : (
            <div className={`flex flex-col items-center gap-3 transition-opacity ${isProcessing ? "opacity-50" : "text-foreground/30"}`}>
              {emptyState ?? <Camera className="w-12 h-12 stroke-[1.5]" />}
              <span className="text-[10px] font-black uppercase tracking-widest px-2">{emptyLabel}</span>
            </div>
          )}

          {/* Loading overlay */}
          {isProcessing && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10">
              <Loader2 className="w-8 h-8 animate-spin text-foreground" />
            </div>
          )}

          {/* Overlays for interaction */}
          {isInteractive && previewUrl && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                removePhoto();
              }}
              className="absolute top-2 right-2 w-8 h-8 bg-es-orange border-2 border-foreground flex items-center justify-center shadow-editorial-sm hover:scale-110 active:scale-95 transition-all text-foreground"
            >
              <X className="w-5 h-5 stroke-[4]" />
            </button>
          )}
        </div>

        {/* Polaroid Signature Area */}
        <div className="flex-1 flex items-center justify-center pt-2">
          {previewUrl ? (
            <div className="flex items-center gap-2 opacity-30">
              <ImageIcon className="w-4 h-4" />
              <span className="text-[9px] font-black uppercase tracking-[0.2em]">SABATINA.PHOTO</span>
            </div>
          ) : footerLabel ? (
            <div className="flex items-center gap-2 opacity-30">
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">{footerLabel}</span>
            </div>
          ) : (
            <div className="w-full h-2 bg-foreground/5 rounded-full" />
          )}
        </div>

        {/* Shadow decoration inside */}
        <div className="absolute bottom-1 right-1 w-full h-full border-b-2 border-r-2 border-foreground/5 pointer-events-none" />
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
        name="photo_input"
      />
    </>
  );
}
