# Auditoria UI/UX

## Referência oficial

A tela de `/responsavel/filhos/novo` passa a ser a referência visual para o app:

- fundo creme chapado
- superfícies brancas com borda preta `4px` e sombra editorial
- cabeçalho principal em bloco branco com subtítulo pequeno e sublinhado lilás
- título de página em caixa alta, peso máximo e tracking apertado
- formulários em duas colunas com polaroid fixa à esquerda
- labels pequenos em caixa alta; labels de dados sensíveis em lilás
- CTA primária em lilás e CTA secundária branca

## Inconsistências encontradas

1. Havia duplicação de shells e cabeçalhos entre `layout.tsx` e páginas, gerando telas com duas barras superiores.
2. Parte das rotas montava cabeçalhos manualmente e outra parte usava `PageHeader`, criando escalas e espaçamentos diferentes.
3. Formulários tinham alturas de campo, pesos tipográficos e cores de botão diferentes entre perfil, cadastro de filho, cadastro de aluno e cadastro de classe.
4. O dropdown do usuário no portal da família exibia uma segunda linha que não existia na referência.
5. Áreas de auth e convites estavam próximas do visual editorial, mas sem compartilhar as mesmas regras de inputs e CTA.

## Padronização aplicada

- `components/ui/design-system.ts` concentra tokens reutilizáveis de superfície, campos, labels e ações.
- `components/ui/UserDropdown.tsx` ganhou modo compacto para o portal da família.
- `app/responsavel/layout.tsx` foi simplificado para virar a fonte única do cabeçalho do responsável.
- `app/alunos/layout.tsx` e `app/classes/layout.tsx` deixaram de adicionar navegação extra fora do padrão.
- Formulários principais passaram a compartilhar a mesma escala:
  - `components/ui/GuardianStudentForm.tsx`
  - `components/ui/ProfileForm.tsx`
  - `components/ui/StudentForm.tsx`
  - `components/ui/ClassForm.tsx`
  - `components/ui/GuardianSignUpForm.tsx`
  - `components/ui/InviteSignUpForm.tsx`
  - `components/ui/ScoringRuleForm.tsx`
- Páginas com cabeçalhos manuais foram migradas para `PageHeader`:
  - `/responsavel`
  - `/responsavel/filhos`
  - `/responsavel/filhos/novo`
  - `/responsavel/filhos/[id]`
  - `/responsavel/matricular`
  - `/responsavel/solicitacoes`
  - `/classes/[id]`

## Pendências não bloqueantes

- Ainda existem warnings de lint para uso de `<img>` em alguns componentes:
  - `app/alunos/page.tsx`
  - `app/responsavel/filhos/page.tsx`
  - `components/ui/AttendanceCard.tsx`
  - `components/ui/EnrollmentRequestCard.tsx`
  - `components/ui/PolaroidPhoto.tsx`

Eles não quebram o visual nem o build, mas valem uma rodada futura de migração para `next/image`.
