# Crystal Realms — MMORPG Idle

Versão transformada para uma base mais próxima de um idle RPG no estilo Legend of Mushroom.

## Como rodar

```bash
npm install
npm start
```

Abra no navegador:

```txt
http://localhost:3000
```

## O que já foi implementado

### PvE e progressão

- Level cap em 80.
- XP_TABLE progressiva dentro de `shared/classes.js`.
- Combate automático a cada 1 segundo.
- Dano validado no servidor.
- Monstro atual com nome, nível, tipo, HP máximo, HP atual e XP.
- Boss automático a cada 10 monstros derrotados.
- Evento `enemyDied` enviado pelo servidor.
- Evolução de asas por nível.

### Visual estilo idle RPG

- HUD superior com XP, ouro, poder, asa e jogadores online.
- Painel lateral do herói.
- Painel de progresso/missão.
- Lista de loot recente.
- Barra de habilidades.
- Menu inferior inspirado em mobile idle RPG.
- Personagens maiores no palco.
- Mago com asas de arcanjo renderizadas no canvas.
- Dano flutuante e efeitos de habilidade.

### Loot e poder

- Ouro ao derrotar monstros.
- Chance de drop de item.
- Raridades: comum, raro, épico e lendário.
- Itens com ataque, defesa, crítico e HP.
- Poder calculado automaticamente com base em nível, classe e itens.
- Equipamentos recentes exibidos no painel lateral.

## Arquivos principais

```txt
server.js
server/managers/CombatManager.js
server/managers/LevelManager.js
server/managers/MonsterManager.js
server/managers/LootManager.js
shared/classes.js
public/index.html
public/css/style.css
public/js/game.js
```

## Próximas melhorias recomendadas

- Persistência em banco de dados.
- Sistema real de equipar/desequipar itens.
- Inventário completo.
- Missões diárias.
- Progressão offline.
- Dungeons.
- World Boss.
- Guildas.
- Ranking.
- Loja e moedas premium.
