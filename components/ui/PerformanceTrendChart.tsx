interface PerformancePoint {
  label: string;
  fullLabel: string;
  studentScore: number;
  classAverage: number;
}

interface PerformanceTrendChartProps {
  data: PerformancePoint[];
  title?: string;
  eyebrow?: string;
  ariaLabel?: string;
  studentLabel?: string;
}

const SVG_WIDTH = 720;
const SVG_HEIGHT = 280;
const PADDING = { top: 28, right: 24, bottom: 48, left: 56 };
const MIN_SLOTS = 5;

function getSlotCount(length: number) {
  return Math.max(length, MIN_SLOTS);
}

function getXPosition(index: number, slotCount: number) {
  const chartWidth = SVG_WIDTH - PADDING.left - PADDING.right;
  return PADDING.left + (chartWidth * index) / Math.max(slotCount - 1, 1);
}

function buildLinePath(values: number[], maxValue: number, slotCount: number) {
  if (values.length === 0) return "";

  const chartHeight = SVG_HEIGHT - PADDING.top - PADDING.bottom;

  return values
    .map((value, index) => {
      const x = getXPosition(index, slotCount);
      const y = PADDING.top + chartHeight - (value / maxValue) * chartHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export default function PerformanceTrendChart({
  data,
  title = "Aluno vs média da turma",
  eyebrow = "Evolução semanal",
  ariaLabel = "Gráfico comparando a pontuação do aluno com a média da turma",
  studentLabel = "Aluno",
}: PerformanceTrendChartProps) {
  const studentColor = "var(--es-orange)";
  const classColor = "var(--es-blue)";
  const maxScore = Math.max(
    10,
    ...data.flatMap((point) => [point.studentScore, point.classAverage]),
  );
  const chartHeight = SVG_HEIGHT - PADDING.top - PADDING.bottom;
  const slotCount = getSlotCount(data.length);
  const studentPath = buildLinePath(data.map((point) => point.studentScore), maxScore, slotCount);
  const averagePath = buildLinePath(data.map((point) => point.classAverage), maxScore, slotCount);
  const yTicks = 4;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-black uppercase tracking-[0.18em] opacity-40">
          {eyebrow}
        </span>
        <h3 className="text-[22px] font-black uppercase tracking-tighter leading-none">
          {title}
        </h3>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 border-2 border-foreground bg-white px-3 py-1.5 shadow-editorial-sm">
          <span className="h-3 w-3 border-2 border-foreground bg-es-orange" />
          <span className="text-[9px] font-black uppercase tracking-widest">{studentLabel}</span>
        </div>
        <div className="flex items-center gap-2 border-2 border-foreground bg-white px-3 py-1.5 shadow-editorial-sm">
          <span className="h-3 w-3 border-2 border-foreground bg-es-blue" />
          <span className="text-[9px] font-black uppercase tracking-widest">Média da turma</span>
        </div>
      </div>

      <div className="bg-white border-4 border-foreground shadow-editorial p-4 md:p-5 overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="min-w-[640px] w-full"
          role="img"
          aria-label={ariaLabel}
        >
          <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="white" />

          {Array.from({ length: yTicks + 1 }).map((_, index) => {
            const value = (maxScore / yTicks) * index;
            const y = PADDING.top + chartHeight - (value / maxScore) * chartHeight;

            return (
              <g key={value}>
                <line
                  x1={PADDING.left}
                  y1={y}
                  x2={SVG_WIDTH - PADDING.right}
                  y2={y}
                  stroke="rgba(17,17,17,0.12)"
                  strokeWidth="2"
                  strokeDasharray="6 8"
                />
                <text
                  x={PADDING.left - 12}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fontWeight="900"
                  letterSpacing="0.18em"
                  fill="rgba(17,17,17,0.45)"
                >
                  {Math.round(value)}
                </text>
              </g>
            );
          })}

          <line
            x1={PADDING.left}
            y1={SVG_HEIGHT - PADDING.bottom}
            x2={SVG_WIDTH - PADDING.right}
            y2={SVG_HEIGHT - PADDING.bottom}
            stroke="var(--foreground)"
            strokeWidth="4"
          />

          <line
            x1={PADDING.left}
            y1={PADDING.top}
            x2={PADDING.left}
            y2={SVG_HEIGHT - PADDING.bottom}
            stroke="var(--foreground)"
            strokeWidth="4"
          />

          <path
            d={averagePath}
            fill="none"
            stroke={classColor}
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="square"
          />

          <path
            d={studentPath}
            fill="none"
            stroke={studentColor}
            strokeWidth="5"
            strokeLinejoin="round"
            strokeLinecap="square"
          />

          {data.map((point, index) => {
            const x = getXPosition(index, slotCount);
            const studentY = PADDING.top + chartHeight - (point.studentScore / maxScore) * chartHeight;
            const averageY = PADDING.top + chartHeight - (point.classAverage / maxScore) * chartHeight;

            return (
              <g key={point.fullLabel}>
                <circle cx={x} cy={averageY} r="7" fill={classColor} stroke="var(--foreground)" strokeWidth="3" />
                <circle cx={x} cy={studentY} r="7" fill={studentColor} stroke="var(--foreground)" strokeWidth="3" />
                <text
                  x={x}
                  y={SVG_HEIGHT - PADDING.bottom + 22}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="900"
                  letterSpacing="0.14em"
                  fill="rgba(17,17,17,0.52)"
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
