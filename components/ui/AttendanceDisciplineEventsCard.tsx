"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Trash2 } from "lucide-react";
import type { AttendanceDisciplineEvent } from "@/lib/types/attendance";

interface AttendanceDisciplineEventsCardProps {
  events: AttendanceDisciplineEvent[];
  canDelete?: boolean;
  onDeleteEvent: (index: number) => void;
}

export default function AttendanceDisciplineEventsCard({
  events,
  canDelete = false,
  onDeleteEvent,
}: AttendanceDisciplineEventsCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const indexedEvents = events
    .map((event, index) => ({ event, index }))
    .reverse();
  const hasEvents = indexedEvents.length > 0;

  return (
    <div
      ref={containerRef}
      className="relative self-start"
      onMouseEnter={() => {
        if (hasEvents) {
          setIsOpen(true);
        }
      }}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className="flex h-[88px] w-full min-w-[96px] flex-col items-center justify-between border-4 border-foreground bg-white px-3 py-3 text-center shadow-editorial-sm transition-all hover:shadow-editorial disabled:opacity-60"
        aria-label="Abrir eventos de indisciplina"
        aria-expanded={isOpen}
        disabled={!hasEvents}
      >
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-es-orange">
          Eventos
        </span>
        <div className="flex h-8 min-w-[3rem] items-center justify-center border-4 border-foreground bg-background px-2.5 text-[12px] font-black uppercase shadow-editorial-sm">
          {events.length}
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-foreground/30 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-30 mt-2 flex max-h-72 w-[18rem] flex-col overflow-hidden border-4 border-foreground bg-[#FFFCEE] shadow-editorial">
          <div className="border-b-4 border-foreground bg-white px-3 py-2.5">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] opacity-40">
              Eventos registrados
            </p>
          </div>

          {indexedEvents.length > 0 ? (
            <div className="flex max-h-60 flex-col overflow-y-auto">
              {indexedEvents.map(({ event, index }, orderIndex) => (
                <div
                  key={event.id || `draft-discipline-event-${index}`}
                  className="flex flex-col gap-1.5 border-b-2 border-foreground/10 px-3 py-2.5 text-left transition-colors hover:bg-es-orange/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.16em]">
                      Evento {indexedEvents.length - orderIndex}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-es-orange">
                        -{Math.max(1, Number(event.points || 1))} pt
                      </span>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => onDeleteEvent(index)}
                          className="flex h-7 w-7 items-center justify-center border-2 border-foreground bg-white text-es-orange shadow-editorial-sm transition-all hover:bg-es-orange/10"
                          aria-label={`Excluir evento ${indexedEvents.length - orderIndex}`}
                          title="Excluir evento"
                        >
                          <Trash2 className="h-3.5 w-3.5 stroke-[2.5]" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <p className="text-[9px] font-bold uppercase leading-relaxed tracking-[0.08em]">
                    {event.reason}
                  </p>

                  <p className="text-[8px] font-black uppercase tracking-[0.16em] opacity-40">
                    {event.appliedByName || "Será registrado ao salvar"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3 px-3 py-3">
              <AlertTriangle className="h-4 w-4 shrink-0 stroke-[3] text-es-orange" />
              <p className="text-[9px] font-black uppercase tracking-[0.16em] opacity-50">
                Nenhum evento de indisciplina registrado.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
