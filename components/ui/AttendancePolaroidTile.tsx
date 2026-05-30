"use client";

import Image from "next/image";
import { Check, Clock3, UserCircle } from "lucide-react";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";
import { formatAttendanceStudentName } from "@/lib/attendance/student-display";
import {
  polaroidCaptionClass,
  polaroidMediaClass,
  polaroidTileClass,
  statusBadgeClass,
} from "@/components/ui/design-system";
import type { AttendanceStudentListItem } from "@/lib/types/attendance";

interface AttendancePolaroidTileProps {
  item: AttendanceStudentListItem;
  status: "pending" | "saved";
  index: number;
  onSelect: (item: AttendanceStudentListItem) => void;
}

const ROTATIONS = ["-rotate-1", "rotate-[0.75deg]", "rotate-1", "-rotate-[0.5deg]"];

export default function AttendancePolaroidTile({
  item,
  status,
  index,
  onSelect,
}: AttendancePolaroidTileProps) {
  const photoSrc = getStudentPhotoSrc(item.student.id, item.student.photo_url);
  const displayName = formatAttendanceStudentName(item.student.full_name);
  const isSaved = status === "saved";

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`group ${polaroidTileClass} touch-manipulation text-left active:shadow-editorial-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-es-lilac ${ROTATIONS[index % ROTATIONS.length]}`}
      aria-label={`Lançar pontos de ${item.student.full_name}`}
    >
      <div className={polaroidMediaClass}>
        {photoSrc ? (
          <Image
            src={photoSrc}
            alt={item.student.full_name}
            fill
            unoptimized
            sizes="(max-width: 640px) 45vw, 180px"
            className={`object-cover transition-all duration-300 group-hover:scale-[1.03] ${isSaved ? "grayscale-[55%]" : "grayscale-[10%]"}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-background">
            <UserCircle className="h-14 w-14 text-foreground/15" />
          </div>
        )}

        <div className={`absolute left-2 top-2 flex h-8 w-8 items-center justify-center border-4 border-foreground shadow-editorial-sm ${isSaved ? "bg-es-green" : "bg-es-yellow"}`}>
          {isSaved ? <Check className="h-4 w-4 stroke-[4]" /> : <Clock3 className="h-4 w-4 stroke-[4]" />}
        </div>
      </div>

      <div className={polaroidCaptionClass}>
        <span className="w-full truncate text-[18px] font-black uppercase tracking-tighter text-foreground">
          {displayName.firstName}
        </span>
        {displayName.surname ? (
          <span className="mt-1 w-full truncate text-[10px] font-black uppercase tracking-[0.18em] text-foreground/45">
            {displayName.surname}
          </span>
        ) : null}
      </div>

      <span className={`absolute -bottom-3 left-1/2 min-w-[88px] -translate-x-1/2 ${statusBadgeClass} ${isSaved ? "bg-es-green" : "bg-surface"}`}>
        {isSaved ? "Finalizado" : "Pendente"}
      </span>
    </button>
  );
}
