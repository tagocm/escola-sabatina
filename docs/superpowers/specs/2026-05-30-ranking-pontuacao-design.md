# Ranking Trimestral de Pontuação

## Contexto

O app da Escola Sabatina já registra presença, critérios de pontuação, pontos extras, descontos por indisciplina e ofertas. A nova seção de ranking será para professores/coordenadores e deve seguir o ciclo real da Escola Sabatina: cada trimestre tem 13 sábados.

O objetivo não é apenas listar quem tem mais pontos. A tela deve ajudar a coordenação a entender liderança, constância, ritmo recente e alunos que precisam de acompanhamento, mantendo o visual editorial/brutalista já documentado no app.

## Decisões Aprovadas

- Público principal: professor/coordenador.
- Período padrão: trimestre de 13 sábados.
- Direção visual aprovada: opção A, com pódio + tabela inteligente.
- Visual: fundo creme, superfícies brancas, borda preta de 4px, sombras duras, cantos quadrados, acentos chapados e tipografia pesada em caixa alta.
- A seção deve ser dinâmica, informativa e divertida, mas sem transformar a experiência em competição agressiva.

## Dados Importantes

A tela deve calcular e exibir:

- Posição no ranking trimestral.
- Total acumulado de pontos por aluno no trimestre.
- Média de pontos por sábado lançado.
- Quantidade de sábados com registro para o aluno.
- Progresso do trimestre: sábados lançados de 13.
- Pontuação padrão possível por sábado, calculada pela soma dos critérios ativos da classe. Pontos extras e descontos por indisciplina não entram nesse máximo porque são ajustes eventuais.
- Pontuação possível até agora: pontuação padrão por sábado multiplicada pela quantidade de sábados lançados.
- Pontuação possível projetada: pontuação padrão por sábado multiplicada por 13.
- Percentual da pontuação possível atingido.
- Média da turma no trimestre.
- Maior pontuação da turma.
- Diferença do aluno para a média da turma.
- Diferença para o aluno imediatamente acima no ranking.
- Ritmo recente, comparando os últimos lançamentos com a média anterior do próprio aluno.
- Status derivado: `Subindo`, `Estável`, `Recuperando` ou `Atenção`.
- Média da turma por sábado para gráfico de ritmo.
- Top pontuações para gráfico de barras.

Dados opcionais para uma segunda etapa:

- Detalhe por aluno com linha do tempo semanal.
- Critérios que mais contribuíram para a pontuação.
- Descontos por indisciplina.
- Histórico de posição no ranking.

## Layout

A tela/seção terá cinco blocos principais.

1. Cabeçalho do ranking

Exibe o título `Pontuação da Turma`, o período trimestral e os indicadores principais:

- `Sábados`: exemplo `8/13`.
- `Média`: média acumulada da turma.
- `Maior`: maior pontuação acumulada.
- `Possível`: pontuação máxima projetada para o trimestre.

2. Filtros rápidos

Controles em formato de botões/tabs com alvo mínimo de 44px:

- `Trimestre`.
- `Até sábado N`.
- `Top 10`.
- `Todos`.
- `Atenção`.
- `Maior subida`.

O padrão de abertura é `Trimestre`.

3. Pódio do trimestre

Mostra os três primeiros colocados com cards mais visuais:

- Primeiro lugar maior e com acento verde.
- Segundo e terceiro em superfícies brancas.
- Foto do aluno quando disponível; fallback visual quando não houver foto.
- Nome, posição, total de pontos e barra de progresso contra a pontuação possível.

4. Gráficos

Dois gráficos complementares:

- Barras horizontais para top pontuações.
- Barras por sábado para média da turma ao longo dos 13 sábados, mostrando barras vazias para semanas ainda não lançadas.

Os gráficos devem usar SVG ou HTML/CSS simples, sem dependência nova, para seguir o padrão já usado em `PerformanceTrendChart`.

5. Tabela completa acionável

Tabela responsiva com rolagem horizontal em telas pequenas. Colunas:

- Posição.
- Aluno.
- Total.
- Média.
- Presença nos lançamentos.
- Ritmo.
- Status.

Cada linha pode ser clicável em etapa futura para abrir um detalhamento do aluno.

## Estados e Regras

### Estado vazio

Quando não houver lançamentos no trimestre, mostrar um estado vazio dentro de superfície editorial:

- Título: `Ainda não há pontuações no trimestre`.
- Texto curto orientando lançar a frequência para iniciar o ranking.
- Ação para ir a `/relatorios/lancamento`.

### Dados parciais

Quando houver menos de 13 sábados lançados, a tela deve deixar explícito que o trimestre está em andamento. O ranking ainda é válido, mas deve mostrar `N/13` e barras vazias nas semanas futuras.

### Empates

Empates devem manter a mesma pontuação visível. A ordenação secundária deve ser estável e previsível:

1. Total acumulado desc.
2. Média por registro desc.
3. Nome do aluno asc.

### Status

Os status devem ser calculados com regras simples:

- `Subindo`: ritmo recente acima da média anterior do aluno.
- `Estável`: variação pequena em relação ao próprio histórico.
- `Recuperando`: aluno abaixo da média da turma, mas com ritmo recente positivo.
- `Atenção`: aluno abaixo da média da turma e com presença baixa ou ritmo recente negativo.

As regras exatas podem ser ajustadas na implementação, mas precisam ser determinísticas e não depender apenas de cor.

## Arquitetura

### Dados

Adicionar uma função server-side para montar o ranking da classe ativa ou de uma classe informada. Ela deve consultar:

- `attendance_days`.
- `student_attendance_records`.
- `students`.
- `class_scoring_rules`.

A função deve retornar dados já agregados para evitar lógica pesada dentro dos componentes de UI.

Formato sugerido:

```ts
interface ClassScoringRankingSummary {
  launchedSaturdays: number;
  totalSaturdays: 13;
  standardPossiblePerSaturday: number;
  possiblePointsToDate: number;
  classAverage: number;
  classHighest: number;
  projectedPossiblePoints: number;
}

interface ClassScoringRankingStudent {
  studentId: string;
  studentName: string;
  photoUrl: string | null;
  rank: number;
  totalPoints: number;
  averagePoints: number;
  recordedSaturdays: number;
  possiblePoints: number;
  progressPercent: number;
  classAverageDelta: number;
  pointsBehindPrevious: number | null;
  recentTrend: number;
  status: "subindo" | "estavel" | "recuperando" | "atencao";
}
```

### Componentes

Criar componentes focados:

- `ClassScoringRankingSection`: composição principal.
- `RankingSummaryPanel`: cabeçalho e métricas.
- `RankingFilters`: filtros rápidos, se forem client-side.
- `RankingPodium`: top 3.
- `RankingBarChart`: top pontuações.
- `RankingWeeklyAverageChart`: média por sábado.
- `RankingTable`: tabela completa.
- `RankingEmptyState`: estado vazio.

### Local de entrada

Adicionar a rota de relatório mais provável:

- `/relatorios/pontuacao`

Também adicionar um card no painel inicial do professor apontando para essa rota. Se o grid inicial precisar manter equilíbrio visual, ele pode passar de 4 para 5 cards com layout responsivo, ou o ranking pode substituir o card de chamada como uma ação secundária na página de relatórios. A recomendação é criar um quinto card, usando acento lilás ou verde conforme o equilíbrio da tela.

## Acessibilidade

- Todos os filtros devem ser botões reais com estado selecionado via `aria-pressed` ou tabs com semântica adequada.
- Gráficos devem ter `role="img"` e `aria-label` descritivo.
- A tabela deve preservar leitura por cabeçalhos.
- Status não pode depender só de cor; precisa ter texto.
- Fotos devem ter alt textual ou serem decorativas quando o nome já estiver ao lado.
- Alvos interativos mínimos de 44px.

## Testes e Verificação

Verificações necessárias:

- `npm run lint`.
- Teste unitário ou helper test para o cálculo de ranking, incluindo empate, aluno sem todos os lançamentos e trimestre parcial.
- Verificação visual em desktop e mobile via browser.
- Conferir que a tela não usa cores cruas bloqueadas por `tests/design-token-usage.test.mjs`.

## Fora de Escopo Inicial

- Ranking visível para responsáveis.
- Drilldown completo por aluno.
- Exportação PDF/CSV.
- Premiações configuráveis.
- Edição de critérios a partir da tela de ranking.

Esses itens podem entrar depois sem alterar o núcleo do ranking trimestral.
