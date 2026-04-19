"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { AttendanceDisciplineEvent } from "@/lib/types/attendance";

interface AttendanceDisciplineEventsCardProps {
  events: AttendanceDisciplineEvent[];
  onEditEvent: (index: number) => void;
}

export default function AttendanceDisciplineEventsCard({
  events,
  onEditEvent,
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
  const totalLostPoints = events.reduce((sum, event) => sum + Math.max(1, Number(event.points || 1)), 0);
  const latestEvent = indexedEvents[0]?.event;
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
        onClick={() => {
          if (!hasEvents) return;
          setIsOpen((current) => !current);
        }}
        className="flex min-h-[116px] w-full flex-col justify-between border-4 border-foreground bg-white px-3 py-3 text-left shadow-editorial-sm transition-all hover:shadow-editorial disabled:opacity-60 lg:min-h-[108px]"
        aria-label="Abrir eventos de indisciplina"
        aria-expanded={isOpen}
        disabled={!hasEvents}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-es-orange">
              Eventos
            </span>
            <span className="text-[8px] font-bold uppercase tracking-[0.16em] opacity-40">
              Histórico de desconto
            </span>
          </div>

          <div className="flex h-8 min-w-8 items-center justify-center border-4 border-foreground bg-background px-2 text-xs font-black uppercase shadow-editorial-sm">
            {events.length}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.16em] opacity-40">
                Total perdido
              </span>
              <span className="mt-1 text-base font-black uppercase tracking-tight">
                -{totalLostPoints}
              </span>
            </div>

            <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.16em] opacity-40">
              <span>{hasEvents ? "Ver" : "Vazio"}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </div>
          </div>

          <div className="border-t-2 border-foreground/10 pt-2">
            <span className="text-[8px] font-black uppercase tracking-[0.16em] opacity-40">
              Último evento
            </span>
            <p className="mt-1 line-clamp-2 text-[10px] font-black uppercase leading-relaxed tracking-[0.08em]">
              {latestEvent?.reason || "Nenhum evento registrado"}
            </p>
          </div>
        </div>
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 flex max-h-72 flex-col overflow-hidden border-4 border-foreground bg-[#FFFCEE] shadow-editorial md:left-auto md:right-0 md:w-[20rem]">
          <div className="border-b-4 border-foreground bg-white px-3 py-2.5">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] opacity-40">
              Eventos registrados
            </p>
          </div>

          {indexedEvents.length > 0 ? (
            <div className="flex max-h-60 flex-col overflow-y-auto">
              {indexedEvents.map(({ event, index }, orderIndex) => (
                <button
                  key={event.id || `draft-discipline-event-${index}`}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onEditEvent(index);
                  }}
                  className="flex flex-col gap-1.5 border-b-2 border-foreground/10 px-3 py-2.5 text-left transition-colors hover:bg-es-orange/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[9px] font-black uppercase tracking-[0.16em]">
                      Evento {indexedEvents.length - orderIndex}
                    </span>
                    <span className="text-[9px] font-black uppercase tracking-[0.16em] text-es-orange">
                      -{Math.max(1, Number(event.points || 1))} pt
                    </span>
                  </div>

                  <p className="text-[9px] font-bold uppercase leading-relaxed tracking-[0.08em]">
                    {event.reason}
                  </p>

                  <p className="text-[8px] font-black uppercase tracking-[0.16em] opacity-40">
                    {event.appliedByName || "Será registrado ao salvar"}
                  </p>
                </button>
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
