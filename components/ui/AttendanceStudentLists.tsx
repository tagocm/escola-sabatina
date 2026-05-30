"use client";

import { useMemo, useState } from "react";
import { Check, Clock3, Search, X } from "lucide-react";
import AttendancePolaroidTile from "@/components/ui/AttendancePolaroidTile";
import AttendanceScoringSheet from "@/components/ui/AttendanceScoringSheet";
import {
  counterBadgeClass,
  fieldLabelClass,
  searchClearButtonClass,
  stickySearchBarClass,
  textInputClass,
} from "@/components/ui/design-system";
import { applySavedAttendanceStudent } from "@/lib/attendance/student-display";
import { filterAttendanceStudents } from "@/lib/attendance/student-search";
import type { AttendanceRule, AttendanceStudentListItem } from "@/lib/types/attendance";

interface AttendanceStudentListsProps {
  classId: string;
  date: string;
  rules: AttendanceRule[];
  pendingStudents: AttendanceStudentListItem[];
  savedStudents: AttendanceStudentListItem[];
}

type SelectedStudent = {
  item: AttendanceStudentListItem;
  status: "pending" | "saved";
} | null;

function EmptySearchState() {
  return (
    <div className="border-4 border-dashed border-foreground/30 bg-surface px-5 py-8 text-center">
      <p className="text-sm font-black uppercase tracking-tight opacity-40">Nenhum aluno encontrado</p>
    </div>
  );
}

export default function AttendanceStudentLists({
  classId,
  date,
  rules,
  pendingStudents,
  savedStudents,
}: AttendanceStudentListsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [studentGroups, setStudentGroups] = useState({
    pendingStudents,
    savedStudents,
  });
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent>(null);

  const visiblePendingStudents = useMemo(
    () => filterAttendanceStudents(studentGroups.pendingStudents, searchQuery),
    [studentGroups.pendingStudents, searchQuery],
  );
  const visibleSavedStudents = useMemo(
    () => filterAttendanceStudents(studentGroups.savedStudents, searchQuery),
    [studentGroups.savedStudents, searchQuery],
  );

  const hasSearch = searchQuery.trim().length > 0;
  const totalStudents = studentGroups.pendingStudents.length + studentGroups.savedStudents.length;
  const totalVisibleStudents = visiblePendingStudents.length + visibleSavedStudents.length;

  const handleSaved = (updatedItem: AttendanceStudentListItem) => {
    setStudentGroups((current) =>
      applySavedAttendanceStudent(
        current.pendingStudents,
        current.savedStudents,
        updatedItem,
      ),
    );
  };

  return (
    <>
      <section className={stickySearchBarClass}>
        <label htmlFor="attendance-student-search" className={fieldLabelClass}>
          Buscar aluno
        </label>

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 stroke-[3] opacity-40" />
          <input
            id="attendance-student-search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Digite o nome"
            className={`${textInputClass} pl-12 pr-12`}
          />
          {hasSearch ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className={searchClearButtonClass}
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4 stroke-[3]" />
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="border-2 border-foreground bg-background px-2 py-2">
            <span className="block text-[8px] font-black uppercase tracking-[0.16em] opacity-35">Exibidos</span>
            <span className="mt-1 block text-sm font-black">{totalVisibleStudents}/{totalStudents}</span>
          </div>
          <div className="border-2 border-foreground bg-es-yellow px-2 py-2">
            <span className="block text-[8px] font-black uppercase tracking-[0.16em] opacity-55">Pend.</span>
            <span className="mt-1 block text-sm font-black">{visiblePendingStudents.length}</span>
          </div>
          <div className="border-2 border-foreground bg-es-green px-2 py-2">
            <span className="block text-[8px] font-black uppercase tracking-[0.16em] opacity-55">Fin.</span>
            <span className="mt-1 block text-sm font-black">{visibleSavedStudents.length}</span>
          </div>
        </div>
      </section>

      {rules.length === 0 ? (
        <div className="border-4 border-dashed border-foreground/30 bg-surface px-6 py-10 text-center">
          <p className="text-lg font-black uppercase tracking-tight opacity-40">Cadastre os critérios de avaliação da classe antes de lançar frequência</p>
        </div>
      ) : null}

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3 border-b-4 border-foreground/10 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-4 border-foreground bg-es-yellow shadow-editorial-sm">
              <Clock3 className="h-5 w-5 stroke-[3]" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter">Pendentes</h2>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/35">
                Toque na foto para lançar
              </p>
            </div>
          </div>
          <span className={counterBadgeClass}>
            {visiblePendingStudents.length}
          </span>
        </div>

        {visiblePendingStudents.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {visiblePendingStudents.map((item, index) => (
              <AttendancePolaroidTile
                key={item.student.id}
                item={item}
                status="pending"
                index={index}
                onSelect={() => setSelectedStudent({ item, status: "pending" })}
              />
            ))}
          </div>
        ) : hasSearch ? (
          <EmptySearchState />
        ) : (
          <div className="border-4 border-dashed border-foreground/30 bg-surface px-5 py-8 text-center">
            <p className="text-lg font-black uppercase tracking-tight opacity-40">Toda a unidade já foi registrada</p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-end justify-between gap-3 border-b-4 border-es-green/20 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-4 border-foreground bg-es-green shadow-editorial-sm">
              <Check className="h-5 w-5 stroke-[3]" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter">Finalizados</h2>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground/35">
                Toque para revisar
              </p>
            </div>
          </div>
          <span className={counterBadgeClass}>
            {visibleSavedStudents.length}
          </span>
        </div>

        {visibleSavedStudents.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {visibleSavedStudents.map((item, index) => (
              <AttendancePolaroidTile
                key={item.student.id}
                item={item}
                status="saved"
                index={index}
                onSelect={() => setSelectedStudent({ item, status: "saved" })}
              />
            ))}
          </div>
        ) : hasSearch ? (
          <EmptySearchState />
        ) : (
          <div className="border-4 border-dashed border-foreground/20 bg-surface px-5 py-8 text-center">
            <p className="text-sm font-black uppercase tracking-tight opacity-40">Nenhum registro finalizado ainda</p>
          </div>
        )}
      </section>

      {selectedStudent ? (
        <AttendanceScoringSheet
          classId={classId}
          date={date}
          item={selectedStudent.item}
          rules={rules}
          isSaved={selectedStudent.status === "saved"}
          onClose={() => setSelectedStudent(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  );
}
