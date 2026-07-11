# Rollout dos períodos de pontuação

## Objetivo operacional

- O Q2 de 2026 termina em `2026-07-04` como `closed_pending_audit`.
- O Q3 de 2026 começa em `2026-07-11` como `open`, com nova contagem.
- Correções do Q2 continuam permitidas, sempre com motivo explícito.
- Somente o proprietário da classe altera o ciclo do período.
- Um período `audited_locked` é somente leitura no banco e na interface.

## Evidência preservada antes do rollout

- Schema: `/tmp/es-public-schema-before-periods-20260710.sql`
  - SHA-256: `3b656a3624cebf4b30a56659397f47601b1af1023c66418cc893d07adb83dd54`
- Dados: `/tmp/es-public-data-before-periods-20260710.sql`
  - SHA-256: `8585a3589895cf30533c81dc065dc3c6ace2de96f7b4556cc34948229c750fd1`

Os dumps contêm dados privados e não devem ser adicionados ao Git.

## Ordem obrigatória

1. Executar os testes e o build da aplicação.
2. Gerar novamente o relatório somente leitura do Q2 e confirmar o baseline conhecido.
3. Confirmar que `supabase db push --dry-run` lista somente `20260711003231_scoring_periods_lifecycle.sql`.
4. Aplicar a migration principal antes de publicar a aplicação.
5. Executar `scripts/verify-scoring-periods.sql` em transação `READ ONLY`.
6. Executar `npm run check:scoring-periods` contra o projeto configurado.
7. Publicar a aplicação.
8. Validar as rotas de ranking, lançamento, ofertas, auditoria e responsável.
9. Promover e aplicar o endurecimento somente após confirmar a nova aplicação em produção.

O arquivo da segunda etapa fica intencionalmente fora de `supabase/migrations`:

```bash
supabase db push --dry-run
supabase db push

# Somente depois do deploy e do smoke test da aplicação nova:
git mv \
  supabase/post_deploy/20260711011516_enforce_scoring_period_app_contract.sql \
  supabase/migrations/20260711011516_enforce_scoring_period_app_contract.sql
supabase db push --dry-run
supabase db push
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/verify-scoring-period-app-contract.sql
```

O primeiro `--dry-run` deve listar apenas a migration principal; o segundo,
apenas `20260711011516`. Não execute um `db push` com os dois arquivos dentro
da pasta ativa.

## Gates

```bash
node --test tests/*.test.mjs
npm run lint
npm run build
npm run report:scoring-q2 > /tmp/es-q2-scoring-report.json
npm run check:scoring-periods
```

Verificação SQL:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/verify-scoring-periods.sql
```

No clone descartável, execute a suíte mutável logo após a migration principal
e antes do cutover de permissões:

```bash
psql "$CLONE_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/verify-scoring-periods-local.sql
```

Depois de aplicar o arquivo `post_deploy`, use apenas
`scripts/verify-scoring-period-app-contract.sql`; a suíte local anterior testa
deliberadamente a compatibilidade de escrita que o cutover acabou de remover.

## Baseline que não pode ser corrigido automaticamente

- 22 registros cujo total salvo difere da soma dos componentes em 1 ponto.
- 7 componentes históricos com valor diferente do catálogo atual.
- 190 inserções sem autoria identificada, concentradas em 27/06 e 04/07.
- 23/05 com 0 registros, 06/06 com 7 e 04/07 com 18.

Esses itens devem aparecer como achados bloqueantes do Q2. A resolução exige evidência ou aceite explícito como exceção; a migração não altera `total_points` nem `points_earned`.

## Validação de 11/07

- A rota de lançamento sem parâmetros abre o Q3 e seleciona `2026-07-11`.
- Abrir `2026-07-04` resolve exclusivamente o Q2.
- Uma leitura não cria `attendance_days`; o registro nasce apenas ao salvar pontos ou oferta.
- O primeiro lançamento do Q3 usa roster e regras snapshot do Q3.
- Ranking, ofertas e responsável começam com totais do Q3, sem carregar o Q2.

## Recuperação

- Se a migração falhar, a transação do Supabase deve ser interrompida; não publique a aplicação.
- Se a aplicação falhar após a migração, reverta apenas a implantação da aplicação. O wrapper legado do banco continua period-aware e preserva os bloqueios.
- Durante a janela entre a migration principal e o deploy, lançamentos do Q3 continuam compatíveis. Correções de pontuação do Q2 exigem motivo específico; uma oferta do Q2 pela interface antiga falha com segurança e deve aguardar a aplicação nova.
- Não promova `enforce_scoring_period_app_contract` antes do deploy: a aplicação anterior ainda cria `attendance_days` em leitura e atualiza ofertas diretamente.
- Não remova tabelas de período nem restaure o dump sobre produção como primeira resposta.
- Restauração de dump exige janela de manutenção e comparação prévia das escritas feitas após o snapshot.
