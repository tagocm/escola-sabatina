"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Expand, X } from "lucide-react";
import PerformanceTrendChart from "@/components/ui/PerformanceTrendChart";

interface PerformancePoint {
  label: string;
  fullLabel: string;
  studentScore: number;
  classAverage: number;
  className?: string;
}

interface PerformanceChartDrilldownProps {
  data: PerformancePoint[];
  title: string;
  eyebrow: string;
  ariaLabel: string;
  classNameLabel: string;
  studentLabel: string;
}

export default function PerformanceChartDrilldown({
  data,
  title,
  eyebrow,
  ariaLabel,
  classNameLabel,
  studentLabel,
}: PerformanceChartDrilldownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const previewData = data.slice(-3);

  const detailRows = data.map((point) => ({
    ...point,
    delta: point.studentScore - point.classAverage,
  }));

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group flex w-full cursor-pointer flex-col gap-3 text-left transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
            Clique para expandir
          </span>
          <div className="flex items-center gap-2 border-2 border-foreground bg-white px-3 py-1.5 shadow-editorial-sm">
            <Expand className="h-3.5 w-3.5 stroke-[3]" />
            <span className="text-[9px] font-black uppercase tracking-widest">Detalhar</span>
          </div>
        </div>

        <PerformanceTrendChart
          data={previewData}
          title={title}
          eyebrow={eyebrow}
          ariaLabel={ariaLabel}
          studentLabel={studentLabel}
        />
      </button>

      {isOpen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/45 p-4 md:p-8">
            <button
              type="button"
              aria-label="Fechar modal"
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 cursor-default"
            />

            <div className="relative z-[121] flex max-h-[90vh] w-full max-w-6xl flex-col gap-6 overflow-y-auto border-4 border-foreground bg-background p-4 shadow-editorial md:p-8">
              <div className="flex items-start justify-between gap-6">
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                    Visão completa
                  </span>
                  <h2 className="text-[24px] md:text-[28px] font-black uppercase tracking-tighter leading-none">
                    {title}
                  </h2>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] opacity-50">
                    {classNameLabel}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-white shadow-editorial-sm transition-all hover:shadow-editorial-hover"
                >
                  <X className="h-5 w-5 stroke-[3]" />
                </button>
              </div>

              <PerformanceTrendChart
                data={data}
                title={title}
                eyebrow={eyebrow}
                ariaLabel={ariaLabel}
                studentLabel={studentLabel}
              />

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-2 border-2 border-foreground bg-es-yellow" />
                  <h3 className="text-xl font-black uppercase tracking-tighter">Detalhamento por data</h3>
                </div>

                <div className="overflow-x-auto border-4 border-foreground bg-white shadow-editorial-sm">
                  <div className="min-w-[720px]">
                  <div className="grid grid-cols-[1.1fr_1fr_0.7fr_0.7fr_0.7fr] border-b-4 border-foreground bg-background px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em]">
                    <span>Data</span>
                    <span>Classe</span>
                    <span>Aluno</span>
                    <span>Turma</span>
                    <span>Diferença</span>
                  </div>

                  {detailRows.map((row) => (
                    <div
                      key={row.fullLabel}
                      className="grid grid-cols-[1.1fr_1fr_0.7fr_0.7fr_0.7fr] border-b-2 border-foreground/10 px-4 py-3 text-sm font-bold uppercase tracking-wide last:border-b-0"
                    >
                      <span>{row.fullLabel}</span>
                      <span>{row.className || classNameLabel}</span>
                      <span>{row.studentScore.toFixed(1)}</span>
                      <span>{row.classAverage.toFixed(1)}</span>
                      <span>{row.delta >= 0 ? `+${row.delta.toFixed(1)}` : row.delta.toFixed(1)}</span>
                    </div>
                  ))}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
