import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileClock,
  History,
  MinusCircle,
  PlusCircle,
  Trophy,
  UserCheck,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getActiveClassContext } from "@/app/actions/classes";
import { getStudentScoringDetail } from "@/app/actions/scoring";
import { getClassScoringPeriodContext } from "@/app/actions/scoring-periods";
import Header from "@/components/ui/Header";
import PageHeader from "@/components/ui/PageHeader";
import PerformanceTrendChart from "@/components/ui/PerformanceTrendChart";
import ScoringPeriodStatusPanel from "@/components/ui/ScoringPeriodStatusPanel";
import {
  fieldLabelClass,
  pageMainClass,
  pageShellClass,
  statusBadgeClass,
  surfaceClass,
  surfaceSoftClass,
} from "@/components/ui/design-system";
import { getStudentPhotoSrc } from "@/lib/storage/student-photos";
import {
  buildStudentScoringChartData,
  buildStudentScoringCumulativeChartData,
  type StudentScoringAuditEntry,
  type ScoringCategory,
  type StudentScoringDetail,
  type StudentScoringDetailWeek,
  type StudentScoringRuleBreakdown,
} from "@/lib/scoring/student-detail";

interface Props {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ period?: string }>;
}

const statusMeta = {
  subindo: { label: "Subindo", className: "bg-es-green" },
  estavel: { label: "Estável", className: "bg-es-yellow" },
  recuperando: { label: "Recuperando", className: "bg-es-lilac" },
  atencao: { label: "Atenção", className: "bg-es-orange" },
} as const;

const categoryMeta: Record<ScoringCategory, { label: string; className: string }> = {
  frequencia: { label: "Frequência", className: "bg-es-blue" },
  espiritual: { label: "Espiritual", className: "bg-es-lilac" },
  atividade: { label: "Atividade", className: "bg-es-yellow" },
  participacao: { label: "Participação", className: "bg-es-orange" },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSigned(value: number) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "--";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function StudentAvatar({
  studentId,
  name,
  photoUrl,
}: {
  studentId: string;
  name: string;
  photoUrl: string | null;
}) {
  const photoSrc = getStudentPhotoSrc(studentId, photoUrl);

  return (
    <div className="relative flex min-h-[240px] w-full items-center justify-center overflow-hidden border-4 border-foreground bg-surface-muted shadow-editorial-sm md:min-h-[320px]">
      {photoSrc ? (
        <Image
          src={photoSrc}
          alt={`Foto de ${name}`}
          fill
          unoptimized
          sizes="(min-width: 1024px) 360px, 100vw"
          className="object-cover"
        />
      ) : (
        <span className="text-6xl font-black uppercase opacity-40 md:text-7xl">
          {initials(name)}
        </span>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "surface",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "surface" | "yellow" | "green" | "orange" | "blue" | "lilac";
}) {
  const toneClass = {
    surface: "bg-surface",
    yellow: "bg-es-yellow",
    green: "bg-es-green",
    orange: "bg-es-orange",
    blue: "bg-es-blue",
    lilac: "bg-es-lilac",
  }[tone];

  return (
    <div className={`border-4 border-foreground px-4 py-4 shadow-editorial-sm ${toneClass}`}>
      <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-50">{label}</span>
      <p className="mt-2 text-3xl font-black leading-none md:text-4xl">{value}</p>
      {detail ? (
        <p className="mt-2 text-[9px] font-black uppercase leading-relaxed tracking-[0.14em] opacity-50">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function RulePill({ rule }: { rule: StudentScoringRuleBreakdown }) {
  const meta = categoryMeta[rule.category];

  return (
    <span className={`inline-flex min-h-8 items-center gap-2 border-2 border-foreground px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${meta.className}`}>
      <span>{rule.name}</span>
      <span className="border-l-2 border-foreground pl-2">{rule.points}</span>
    </span>
  );
}

function EmptyCell({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-black uppercase tracking-[0.14em] opacity-35">
      {children}
    </span>
  );
}

function formatShortId(value: string | null | undefined) {
  if (!value) return "--";
  return value.slice(0, 8);
}

function formatAuditOperation(operation: string) {
  const labels: Record<string, string> = {
    baseline: "Snapshot",
    insert: "Criado",
    update: "Alterado",
    delete: "Removido",
  };

  return labels[operation] || operation;
}

function formatAuditTable(tableName: string) {
  const labels: Record<string, string> = {
    student_attendance_records: "Registro",
    attendance_scores: "Critério",
    attendance_discipline_events: "Indisciplina",
  };

  return labels[tableName] || tableName;
}

function readAuditValue(entry: StudentScoringAuditEntry, key: string) {
  return entry.newData?.[key] ?? entry.oldData?.[key] ?? null;
}

function formatAuditNumber(value: unknown) {
  if (typeof value === "number") return formatNumber(value);
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return formatNumber(Number(value));
  }
  return "--";
}

function formatAuditText(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return "--";
}

function describeAuditEntry(entry: StudentScoringAuditEntry) {
  if (entry.operation === "baseline") {
    return "Estado existente preservado antes da auditoria robusta.";
  }

  if (entry.tableName === "student_attendance_records") {
    const oldTotal = entry.oldData?.total_points;
    const newTotal = entry.newData?.total_points;
    const oldExtra = entry.oldData?.extra_activity_points;
    const newExtra = entry.newData?.extra_activity_points;
    const oldPenalty = entry.oldData?.discipline_penalty_points;
    const newPenalty = entry.newData?.discipline_penalty_points;

    return [
      `Total ${formatAuditNumber(oldTotal)} -> ${formatAuditNumber(newTotal)}`,
      `Extra ${formatAuditNumber(oldExtra)} -> ${formatAuditNumber(newExtra)}`,
      `Desconto ${formatAuditNumber(oldPenalty)} -> ${formatAuditNumber(newPenalty)}`,
    ].join(" / ");
  }

  if (entry.tableName === "attendance_scores") {
    const ruleId = formatShortId(formatAuditText(readAuditValue(entry, "rule_id")));
    const points = formatAuditNumber(readAuditValue(entry, "points_earned"));
    return `Critério ${ruleId} com ${points} ponto(s).`;
  }

  if (entry.tableName === "attendance_discipline_events") {
    const points = formatAuditNumber(readAuditValue(entry, "points"));
    const reason = formatAuditText(readAuditValue(entry, "reason"));
    return `Desconto de ${points} ponto(s). Motivo: ${reason}`;
  }

  return "Alteração registrada na pontuação.";
}

function CategoryBars({ detail }: { detail: StudentScoringDetail }) {
  return (
    <section className={`${surfaceClass} flex flex-col gap-5 p-5 md:p-6`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-es-yellow shadow-editorial-sm">
          <BarChart3 className="h-5 w-5 stroke-[3]" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase leading-none">Composição dos pontos</h2>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
            Critérios marcados, extras e descontos
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.72fr]">
        <div className="flex flex-col gap-3">
          {detail.categorySummaries.map((category) => {
            const meta = categoryMeta[category.category];
            const width = category.possiblePoints > 0
              ? Math.min(100, Math.max(4, category.progressPercent))
              : 0;

            return (
              <div key={category.category} className="grid grid-cols-[minmax(0,7rem)_1fr_4.5rem] items-center gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.12em]">
                  {meta.label}
                </span>
                <div className="relative h-8 overflow-hidden border-4 border-foreground bg-background shadow-editorial-sm">
                  <div className={`absolute inset-y-0 left-0 ${meta.className}`} style={{ width: `${width}%` }} />
                </div>
                <span className="text-right text-[10px] font-black uppercase tracking-[0.12em]">
                  {formatNumber(category.points)}/{formatNumber(category.possiblePoints)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <MetricCard
            label="Atividade extra"
            value={`+${formatNumber(detail.adjustmentTotals.extraActivityPoints)}`}
            detail="Pontos fora dos critérios"
            tone="green"
          />
          <MetricCard
            label="Indisciplina"
            value={`-${formatNumber(detail.adjustmentTotals.disciplinePenaltyPoints)}`}
            detail={`${detail.disciplineEvents.length} ocorrência(s) registradas`}
            tone={detail.adjustmentTotals.disciplinePenaltyPoints > 0 ? "orange" : "surface"}
          />
        </div>
      </div>
    </section>
  );
}

function DiagnosticGrid({ detail }: { detail: StudentScoringDetail }) {
  const deltaTone = detail.summary.classAverageDelta >= 0 ? "green" : "orange";
  const previousDetail = detail.summary.pointsBehindPrevious === null
    ? "Aluno está no topo do ranking"
    : `Faltam ${formatNumber(detail.summary.pointsBehindPrevious)} ponto(s)`;
  const presenceTone = detail.summary.daysWithoutRecord > 0 ? "orange" : "blue";
  const trendTone = detail.summary.recentTrend > 0
    ? "green"
    : detail.summary.recentTrend < 0
      ? "orange"
      : "surface";

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        label="Diferença da turma"
        value={formatSigned(detail.summary.classAverageDelta)}
        detail="Comparado ao acumulado médio"
        tone={deltaTone}
      />
      <MetricCard
        label="Próxima posição"
        value={detail.summary.pointsBehindPrevious === null ? "Líder" : formatNumber(detail.summary.pointsBehindPrevious)}
        detail={previousDetail}
        tone="yellow"
      />
      <MetricCard
        label="Presença lançada"
        value={`${detail.summary.recordedSaturdays}/${detail.summary.launchedSaturdays}`}
        detail={`${detail.summary.daysWithoutRecord} sábado(s) sem registro`}
        tone={presenceTone}
      />
      <MetricCard
        label="Ritmo recente"
        value={formatSigned(detail.summary.recentTrend)}
        detail="Último sábado contra média anterior"
        tone={trendTone}
      />
    </section>
  );
}

function AuditLogSection({ detail }: { detail: StudentScoringDetail }) {
  return (
    <section className={`${surfaceClass} flex flex-col gap-5 p-5 md:p-6`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-es-green shadow-editorial-sm">
          <FileClock className="h-5 w-5 stroke-[3]" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase leading-none">Log de auditoria</h2>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
            Histórico de alterações com motivo, ator e horário
          </p>
        </div>
      </div>

      {detail.auditLog.length > 0 ? (
        <div className="overflow-x-auto border-4 border-foreground bg-surface shadow-editorial-sm">
          <div className="min-w-[1040px]">
            <div className="grid grid-cols-[9rem_11rem_7rem_7rem_1.2fr_1.5fr_6rem] gap-3 border-b-4 border-foreground bg-background px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em]">
              <span>Quando</span>
              <span>Responsável</span>
              <span>Área</span>
              <span>Ação</span>
              <span>Motivo</span>
              <span>Resumo</span>
              <span>Grupo</span>
            </div>

            {detail.auditLog.map((entry) => (
              <div
                key={entry.id}
                className="grid grid-cols-[9rem_11rem_7rem_7rem_1.2fr_1.5fr_6rem] items-start gap-3 border-b-2 border-foreground/10 px-4 py-4 text-[10px] font-bold uppercase leading-relaxed tracking-[0.08em] last:border-b-0"
              >
                <span className="font-black">{formatDateTime(entry.changedAt)}</span>
                <span>{entry.actorName}</span>
                <span className="font-black">{formatAuditTable(entry.tableName)}</span>
                <span>{formatAuditOperation(entry.operation)}</span>
                <span>{entry.reason}</span>
                <span>{describeAuditEntry(entry)}</span>
                <span className="font-mono text-[9px] uppercase opacity-55">
                  {entry.requestId ? formatShortId(entry.requestId) : formatShortId(String(entry.transactionId || ""))}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-4 border-dashed border-foreground/25 bg-background p-6 text-center shadow-editorial-sm">
          <p className="text-sm font-black uppercase tracking-[0.12em] opacity-45">
            Nenhum evento de auditoria registrado para este participante.
          </p>
        </div>
      )}
    </section>
  );
}

function TimelineTable({
  detail,
  periodId,
}: {
  detail: StudentScoringDetail;
  periodId?: string;
}) {
  return (
    <section className={`${surfaceClass} flex flex-col gap-5 p-5 md:p-6`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-es-lilac shadow-editorial-sm">
          <ClipboardList className="h-5 w-5 stroke-[3]" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase leading-none">Auditoria por sábado</h2>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
            Total, critérios, extras, descontos e comparação com a turma
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border-4 border-foreground bg-surface shadow-editorial-sm">
        <div className="min-w-[1180px]">
          <div className="grid grid-cols-[4.5rem_6.5rem_5rem_5rem_5rem_5rem_1.3fr_1.1fr_1.3fr_5.5rem] gap-3 border-b-4 border-foreground bg-background px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em]">
            <span>Semana</span>
            <span>Data</span>
            <span>Total</span>
            <span>Turma</span>
            <span>Maior</span>
            <span>Rank dia</span>
            <span>Critérios marcados</span>
            <span>Não marcados</span>
            <span>Ajustes</span>
            <span>Editar</span>
          </div>

          {detail.timeline.map((week) => (
            <TimelineRow key={week.dayDate} week={week} periodId={periodId} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LaunchRecords({
  detail,
  periodId,
}: {
  detail: StudentScoringDetail;
  periodId?: string;
}) {
  const launchRecords = detail.timeline
    .filter((week) => week.hasRecord)
    .sort((left, right) => right.dayDate.localeCompare(left.dayDate));

  return (
    <section className={`${surfaceClass} flex flex-col gap-5 p-5 md:p-6`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-es-blue shadow-editorial-sm">
          <History className="h-5 w-5 stroke-[3]" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase leading-none">Registros de lançamento</h2>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
            Pontos salvos, responsável, data e horário do lançamento
          </p>
        </div>
      </div>

      {launchRecords.length > 0 ? (
        <div className="overflow-x-auto border-4 border-foreground bg-surface shadow-editorial-sm">
          <div className="min-w-[940px]">
            <div className="grid grid-cols-[4.5rem_7rem_5rem_1fr_1fr_9rem_5.5rem] gap-3 border-b-4 border-foreground bg-background px-4 py-3 text-[9px] font-black uppercase tracking-[0.16em]">
              <span>Semana</span>
              <span>Sábado</span>
              <span>Pontos</span>
              <span>Composição</span>
              <span>Responsável</span>
              <span>Lançado em</span>
              <span>Revisar</span>
            </div>

            {launchRecords.map((week) => (
              <div
                key={week.recordId || week.dayDate}
                className="grid grid-cols-[4.5rem_7rem_5rem_1fr_1fr_9rem_5.5rem] items-center gap-3 border-b-2 border-foreground/10 px-4 py-4 text-sm font-bold uppercase last:border-b-0"
              >
                <span className="flex h-9 w-9 items-center justify-center border-4 border-foreground bg-es-yellow text-xs font-black shadow-editorial-sm">
                  {week.weekNumber}
                </span>
                <span className="font-black">{week.fullLabel}</span>
                <span>{formatNumber(week.totalPoints)}</span>
                <span className="text-[10px] font-black uppercase leading-relaxed tracking-[0.12em]">
                  Base {formatNumber(week.baseRulePoints)} / Extra +{formatNumber(week.extraActivityPoints)} / Desconto -{formatNumber(week.disciplinePenaltyPoints)}
                </span>
                <span className="font-black tracking-tight">
                  {week.savedByName || "Professor não identificado"}
                </span>
                <span className="text-[10px] font-black uppercase leading-relaxed tracking-[0.12em]">
                  {formatDateTime(week.savedAt)}
                </span>
                <Link
                  href={`/relatorios/lancamento?d=${week.dayDate}${periodId ? `&period=${periodId}` : ""}`}
                  className="inline-flex min-h-9 items-center justify-center border-2 border-foreground bg-es-blue px-2 text-[9px] font-black uppercase tracking-[0.14em] shadow-editorial-sm transition-all hover:shadow-editorial-hover active:translate-x-0.5 active:translate-y-0.5"
                >
                  Abrir
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-4 border-dashed border-foreground/25 bg-background p-6 text-center shadow-editorial-sm">
          <p className="text-sm font-black uppercase tracking-[0.12em] opacity-45">
            Nenhum lançamento finalizado para este participante.
          </p>
        </div>
      )}
    </section>
  );
}

function TimelineRow({
  week,
  periodId,
}: {
  week: StudentScoringDetailWeek;
  periodId?: string;
}) {
  const adjustmentText = [
    week.extraActivityPoints > 0 ? `+${formatNumber(week.extraActivityPoints)} extra` : null,
    week.disciplinePenaltyPoints > 0 ? `-${formatNumber(week.disciplinePenaltyPoints)} indisc.` : null,
  ].filter(Boolean);

  return (
    <div className={`grid grid-cols-[4.5rem_6.5rem_5rem_5rem_5rem_5rem_1.3fr_1.1fr_1.3fr_5.5rem] gap-3 border-b-2 border-foreground/10 px-4 py-4 text-sm font-bold uppercase last:border-b-0 ${week.hasRecord ? "bg-surface" : "bg-background"}`}>
      <span className="flex h-9 w-9 items-center justify-center border-4 border-foreground bg-es-yellow text-xs font-black shadow-editorial-sm">
        {week.weekNumber}
      </span>
      <span className="font-black">{week.fullLabel}</span>
      <span>{week.hasRecord ? formatNumber(week.totalPoints) : "--"}</span>
      <span>{week.classSize > 0 ? formatNumber(week.classAverage) : "--"}</span>
      <span>{week.classSize > 0 ? formatNumber(week.classHighest) : "--"}</span>
      <span>{week.dailyRank ? `#${week.dailyRank}` : "--"}</span>

      <div className="flex flex-wrap gap-2">
        {week.selectedRules.length > 0 ? (
          week.selectedRules.map((rule) => <RulePill key={rule.ruleId} rule={rule} />)
        ) : (
          <EmptyCell>{week.isElapsed ? "Sem critérios" : "Futuro"}</EmptyCell>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {week.missedRules.length > 0 ? (
          week.missedRules.map((rule) => (
            <span
              key={rule.ruleId}
              className="inline-flex min-h-8 items-center border-2 border-foreground bg-background px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] opacity-60"
            >
              {rule.name}
            </span>
          ))
        ) : (
          <EmptyCell>{week.hasRecord ? "Completo" : "Sem registro"}</EmptyCell>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {adjustmentText.length > 0 ? (
          <span className="text-[10px] font-black uppercase tracking-[0.12em]">
            {adjustmentText.join(" / ")}
          </span>
        ) : (
          <EmptyCell>Sem ajustes</EmptyCell>
        )}
        {week.disciplineEvents.map((event) => (
          <span key={event.id} className="text-[9px] font-bold uppercase leading-relaxed tracking-[0.08em] opacity-60">
            {event.reason}
          </span>
        ))}
      </div>

      {week.isElapsed ? (
        <Link
          href={`/relatorios/lancamento?d=${week.dayDate}${periodId ? `&period=${periodId}` : ""}`}
          className="inline-flex min-h-9 items-center justify-center border-2 border-foreground bg-es-blue px-2 text-[9px] font-black uppercase tracking-[0.14em] shadow-editorial-sm transition-all hover:shadow-editorial-hover active:translate-x-0.5 active:translate-y-0.5"
        >
          Abrir
        </Link>
      ) : (
        <EmptyCell>Futuro</EmptyCell>
      )}
    </div>
  );
}

function DisciplineEvents({ detail }: { detail: StudentScoringDetail }) {
  return (
    <section className={`${surfaceSoftClass} flex flex-col gap-4 p-5 md:p-6`}>
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center border-4 border-foreground bg-es-orange shadow-editorial-sm">
          <AlertTriangle className="h-5 w-5 stroke-[3]" />
        </div>
        <div>
          <h2 className="text-xl font-black uppercase leading-none">Ocorrências</h2>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
            Descontos por indisciplina registrados
          </p>
        </div>
      </div>

      {detail.disciplineEvents.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {detail.disciplineEvents.map((event) => (
            <article key={event.id} className="border-4 border-foreground bg-surface p-4 shadow-editorial-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={fieldLabelClass}>{event.dayLabel}</span>
                  <h3 className="mt-2 text-lg font-black uppercase leading-none">
                    -{formatNumber(event.points)} ponto(s)
                  </h3>
                </div>
                <span className={`${statusBadgeClass} bg-es-orange`}>Indisciplina</span>
              </div>
              <p className="mt-3 text-[11px] font-bold uppercase leading-relaxed tracking-[0.08em] opacity-70">
                {event.reason}
              </p>
              <p className="mt-3 text-[9px] font-black uppercase tracking-[0.16em] opacity-40">
                Aplicado por {event.appliedByName}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="border-4 border-dashed border-foreground/25 bg-background p-6 text-center shadow-editorial-sm">
          <p className="text-sm font-black uppercase tracking-[0.12em] opacity-45">
            Nenhuma ocorrência de indisciplina registrada para este participante.
          </p>
        </div>
      )}
    </section>
  );
}

export default async function StudentScoringDetailPage({ params, searchParams }: Props) {
  const { studentId } = await params;
  const query = await searchParams;
  const classId = await getActiveClassContext();
  if (!classId) redirect("/classes");

  const periodContext = await getClassScoringPeriodContext(classId, {
    periodId: query.period,
  });
  const selectedPeriod = periodContext.selectedPeriod;
  const detail = await getStudentScoringDetail(
    classId,
    studentId,
    selectedPeriod?.id || query.period,
  );

  if ("error" in detail) {
    return (
      <div className={pageShellClass}>
        <Header />
        <main className={pageMainClass}>
          <PageHeader
            title="Detalhe da pontuação"
            subtitle="Auditoria individual do participante"
            backHref={selectedPeriod
              ? `/relatorios/pontuacao?period=${selectedPeriod.id}`
              : "/relatorios/pontuacao"}
            backLabel="Voltar ao Ranking"
          />
          <section className={`${surfaceClass} p-6 md:p-8`}>
            <p className="text-lg font-black uppercase tracking-[0.12em]">{detail.error}</p>
          </section>
        </main>
      </div>
    );
  }

  const status = statusMeta[detail.summary.status];
  const weeklyChartData = buildStudentScoringChartData(detail);
  const cumulativeChartData = buildStudentScoringCumulativeChartData(detail);
  const bestCategoryLabel = detail.strongestCategory
    ? `${detail.strongestCategory.label} ${formatNumber(detail.strongestCategory.progressPercent)}%`
    : "Sem categoria ativa";
  const weakestCategoryLabel = detail.weakestCategory
    ? `${detail.weakestCategory.label} ${formatNumber(detail.weakestCategory.progressPercent)}%`
    : "Sem categoria ativa";

  return (
    <div className={pageShellClass}>
      <Header />

      <main className={pageMainClass}>
        <PageHeader
          title="Detalhe da Pontuação"
          subtitle="Auditoria individual por sábado, critérios e evolução"
          backHref={selectedPeriod
            ? `/relatorios/pontuacao?period=${selectedPeriod.id}`
            : "/relatorios/pontuacao"}
          backLabel="Voltar ao Ranking"
        />

        {selectedPeriod ? (
          <ScoringPeriodStatusPanel
            periodName={selectedPeriod.label}
            status={selectedPeriod.status}
            elapsed={detail.summary.elapsedSaturdays}
            withRecords={detail.summary.saturdaysWithRecords}
            complete={detail.summary.completeSaturdays}
            expected={detail.summary.totalSaturdays}
          />
        ) : null}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[0.72fr_1.28fr] md:gap-6">
          <StudentAvatar
            studentId={detail.student.id}
            name={detail.student.name}
            photoUrl={detail.student.photoUrl}
          />

          <div className={`${surfaceClass} flex min-w-0 flex-col gap-6 p-5 md:p-6`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-45">
                  {detail.student.className || "Turma ativa"}
                </span>
                <h1 className="mt-2 break-words text-[34px] font-black uppercase leading-none md:text-[52px]">
                  {detail.student.name}
                </h1>
              </div>
              <span className={`${statusBadgeClass} ${status.className} shrink-0`}>
                {status.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Ranking" value={`#${detail.summary.rank}`} detail="Posição atual" tone="yellow" />
              <MetricCard label="Total" value={formatNumber(detail.summary.totalPoints)} detail="Pontos acumulados" tone="green" />
              <MetricCard label="Média" value={formatNumber(detail.summary.averagePoints)} detail="Por sábado registrado" tone="surface" />
              <MetricCard label="Progresso" value={`${formatNumber(detail.summary.progressPercent)}%`} detail={`${formatNumber(detail.summary.possiblePointsToDate)} pts possíveis`} tone="blue" />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="flex items-center gap-3 border-4 border-foreground bg-background p-3 shadow-editorial-sm">
                <Trophy className="h-5 w-5 shrink-0 stroke-[3]" />
              <span className="text-[10px] font-black uppercase leading-relaxed tracking-[0.14em]">
                Maior total da classe: {formatNumber(detail.summary.classHighest)}
              </span>
              </div>
              <div className="flex items-center gap-3 border-4 border-foreground bg-background p-3 shadow-editorial-sm">
                <Award className="h-5 w-5 shrink-0 stroke-[3]" />
                <span className="text-[10px] font-black uppercase leading-relaxed tracking-[0.14em]">
                  Melhor categoria: {bestCategoryLabel}
                </span>
              </div>
              <div className="flex items-center gap-3 border-4 border-foreground bg-background p-3 shadow-editorial-sm">
                <CalendarClock className="h-5 w-5 shrink-0 stroke-[3]" />
                <span className="text-[10px] font-black uppercase leading-relaxed tracking-[0.14em]">
                  Últimos lançamentos com data, horário e responsável.
                </span>
              </div>
              <div className="flex items-center gap-3 border-4 border-foreground bg-background p-3 shadow-editorial-sm">
                <AlertTriangle className="h-5 w-5 shrink-0 stroke-[3]" />
                <span className="text-[10px] font-black uppercase leading-relaxed tracking-[0.14em]">
                  Ponto de atenção: {weakestCategoryLabel}
                </span>
              </div>
            </div>
          </div>
        </section>

        <DiagnosticGrid detail={detail} />

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2 md:gap-8">
          <div className="min-w-0">
            <PerformanceTrendChart
              data={weeklyChartData}
              title="Aluno vs média da turma"
              eyebrow="Pontuação semanal"
              ariaLabel="Gráfico semanal comparando o participante com a média da turma"
              studentLabel={detail.student.name.split(" ")[0] || "Aluno"}
            />
          </div>

          <div className="min-w-0">
            <PerformanceTrendChart
              data={cumulativeChartData}
              title="Acumulado comparado"
              eyebrow="Evolução trimestral"
              ariaLabel="Gráfico acumulado comparando o participante com a média acumulada da turma"
              studentLabel={detail.student.name.split(" ")[0] || "Aluno"}
            />
          </div>
        </section>

        <CategoryBars detail={detail} />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className={`${surfaceSoftClass} flex items-center gap-3 p-4`}>
            <CheckCircle2 className="h-6 w-6 shrink-0 stroke-[3]" />
            <span className="text-[10px] font-black uppercase leading-relaxed tracking-[0.14em]">
              {detail.timeline.filter((week) => week.hasRecord && week.missedRules.length === 0).length} sábado(s) com critérios completos.
            </span>
          </div>
          <div className={`${surfaceSoftClass} flex items-center gap-3 p-4`}>
            <PlusCircle className="h-6 w-6 shrink-0 stroke-[3]" />
            <span className="text-[10px] font-black uppercase leading-relaxed tracking-[0.14em]">
              {formatNumber(detail.adjustmentTotals.extraActivityPoints)} ponto(s) extras no trimestre.
            </span>
          </div>
          <div className={`${surfaceSoftClass} flex items-center gap-3 p-4`}>
            {detail.adjustmentTotals.disciplinePenaltyPoints > 0 ? (
              <MinusCircle className="h-6 w-6 shrink-0 stroke-[3]" />
            ) : (
              <UserCheck className="h-6 w-6 shrink-0 stroke-[3]" />
            )}
            <span className="text-[10px] font-black uppercase leading-relaxed tracking-[0.14em]">
              {formatNumber(detail.adjustmentTotals.disciplinePenaltyPoints)} ponto(s) descontados por indisciplina.
            </span>
          </div>
        </section>

        <LaunchRecords detail={detail} periodId={selectedPeriod?.id} />
        <AuditLogSection detail={detail} />
        <TimelineTable detail={detail} periodId={selectedPeriod?.id} />
        <DisciplineEvents detail={detail} />
      </main>
    </div>
  );
}
