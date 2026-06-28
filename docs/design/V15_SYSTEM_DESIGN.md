# V15 — Design Sênior para Progressão sem Lâmpada/Gacha

## 1. Loop Alternativo de Loot e Equipamento

### Lógica/Psicologia
O jogador precisa sentir que cada monstro morto pode melhorar sua conta. O drop não deve parecer “gacha externo”, e sim consequência direta do combate. Por isso, cada item nasce de três camadas: item base, raridade e rolagens variáveis. A emoção vem de ver o número de poder subir e de receber sugestão imediata de auto-equipar.

### Banco SQL
Use `ItemDefinition` para a identidade do item e `PlayerItem` para a instância única. Stats variáveis ficam em `PlayerItemStatRoll`. Isso evita inflar uma coluna JSON gigante e permite ranking, filtros e comparação com índice.

### Python
`DropManager.roll_item()` escolhe a tabela do estágio, rola raridade, qualidade e afixos. `suggest_auto_equip()` compara `PowerScore` do item novo com o equipado do mesmo slot.

## 2. Combate com Skill-Tree e Atributos

### Lógica/Psicologia
O combate precisa parecer ativo mesmo sendo idle. A fila de skills dá ritmo: skills rápidas mantêm feedback constante; skills longas criam picos de dano. Speed reduz intervalos, Crit cria momentos de excitação, Evasion evita dano e aumenta sobrevivência.

### Banco SQL
Mantenha atributos agregados/materializados por personagem em uma tabela de snapshot, recalculada somente quando equipamento, pet, skill-tree ou gema mudarem. Não some todos os itens a cada hit.

### Python
`SkillQueue.tick(now)` percorre skills ordenadas por prioridade/cooldown. O cálculo usa `AttributeSet`, não queries repetidas no combate.

## 3. Progressão Idle Inteligente

### Lógica/Psicologia
Offline reward deve recompensar retorno, mas não substituir jogar. Use cap de horas e eficiência baseada no estágio atual.

### Banco SQL
Salve `LastOnlineAt`, `StageId`, `PowerSnapshot` e `KillsPerMinuteSnapshot`. Ao logar, calcule recompensa com base nesse snapshot.

### Python
`calculate_offline_reward()` usa estágio, cap e curva suave. O ganho cresce com stage, mas é limitado por tempo e eficiência.

## 4. Pets/Companheiros

### Lógica/Psicologia
Pets são foco visual e de coleção. Eles criam metas paralelas ao loot: montar sinergias, evoluir favoritos e buscar bônus elementais.

### Banco SQL
Use `PetDefinition`, `PlayerPet` e `PlayerPetFormation`. Sinergias podem ser calculadas por elemento em memória e materializadas no snapshot.

### Python
`PetManager.get_synergy()` conta elementos equipados e retorna bônus como “2 fogo = +10% dano”.

## 5. UX Fluida

### Lógica/Psicologia
O cliente deve receber eventos pequenos: dano, crit, skillId, hp restante e drops. Ele não precisa recalcular combate.

### Banco SQL
Nada de query por número flutuante. O servidor envia eventos compactos em lotes por tick.

### Python
O servidor acumula eventos em uma lista por tick e envia payload único: `combatEvents`, `xpDelta`, `loot`, `equipSuggestion`.