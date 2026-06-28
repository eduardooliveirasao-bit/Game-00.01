# Legend Of Indle RPG V1 — Sistemas V21 a V24

## V21 — Missões Diárias
Loop de objetivos curtos para aumentar retenção diária: matar monstros, derrotar bosses, obter loot, forjar itens e coletar expedições.

## V22 — Codex de Monstros
Progressão permanente por domínio de espécies. O jogador sente avanço mesmo quando o drop não vem.

## V23 — Zonas por Horda
As hordas destravam zonas com identidade e multiplicadores de economia. A progressão deixa de parecer infinita e passa a ter marcos.

## V24 — Ascensão e Artefatos
Meta progressão de longo prazo. O jogador renasce, acumula poeira astral e evolui artefatos permanentes.

## Integração técnica
- Novos dados persistidos: missions, codex, ascension, season, extraTalentPoints.
- Novo manager: `server/managers/MetaProgressManager.js`.
- Novos eventos socket: `claimMission`, `claimAllMissions`, `claimCodex`, `upgradeArtifact`, `ascendPlayer`.
- UI: novos modais e botões para Missões, Codex e Ascensão.
