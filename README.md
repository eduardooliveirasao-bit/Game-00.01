# Crystal Realms — MMORPG Idle

Base Node.js + Express + Socket.IO para um MMORPG Idle inspirado em jogos como Legend of Mushroom, com combate automático, monstro atual, XP, nível máximo e evolução visual das asas.

## Como rodar

```bash
npm install
npm start
```

Depois abra:

```txt
http://localhost:3000
```

## O que foi implementado nesta versão

### PvE / Monstro atual

- Um `MonsterManager` no servidor instancia o monstro atual.
- Cada monstro possui:
  - nome;
  - nível;
  - HP máximo;
  - HP atual;
  - XP concedida ao morrer;
  - tipo: normal, elite ou boss.
- A cada 10 mortes nasce um boss mais forte.
- Quando o HP chega a 0, o servidor emite `enemyDied`, entrega XP ao jogador que matou e gera o próximo monstro.

### Leveling

- Level cap em 80.
- `XP_TABLE` progressiva do nível 1 ao 80 em `shared/classes.js`.
- `LevelManager` controla ganho de XP, level up, XP restante, barra de XP e evolução das asas.
- O personagem aparece no formato:

```txt
Aventureiro-abcd [Nv. 1]
```

### Combate Idle

- O servidor executa um loop de combate a cada 1 segundo.
- O dano é validado no servidor, não no cliente.
- Fórmula base:

```txt
dano = baseDanoDaClasse + (nivel * multiplicadorDaClasse)
```

- Habilidades também são validadas no servidor com cooldown.
- O cliente apenas pede o uso da habilidade; quem decide dano, crítico e cooldown é o servidor.

### Frontend

- Barra de HP do monstro.
- Nome, nível e tipo do monstro.
- Barra de XP do jogador em tempo real.
- Log de combate.
- Dano flutuante no canvas.
- Mago com asas visuais de arcanjo.
- Guerreiro, arqueiro e mago com identidades próprias.

## Estrutura principal

```txt
MeuJogoIdle/
├── server.js
├── server/
│   └── managers/
│       ├── CombatManager.js
│       ├── LevelManager.js
│       └── MonsterManager.js
├── shared/
│   └── classes.js
└── public/
    ├── index.html
    ├── css/style.css
    └── js/game.js
```

## Eventos Socket.IO principais

### Servidor → Cliente

- `init`: envia jogador, jogadores online, monstro atual e level cap.
- `playerUpdated`: atualiza dados públicos do jogador.
- `gameState`: sincroniza lista de jogadores.
- `enemyUpdate`: atualiza HP/dados do monstro atual.
- `enemyDied`: informa morte do monstro, XP recebida e próximo monstro.
- `combatTick`: envia ataques realizados no tick para efeitos visuais.
- `abilityUsed`: sincroniza efeito visual de habilidade.

### Cliente → Servidor

- `selectClass`: seleciona guerreiro, arqueiro ou mago.
- `useAbility`: tenta usar uma habilidade; o servidor valida cooldown e dano.

## Próximos sistemas recomendados

1. Loot e equipamentos.
2. Inventário.
3. Dungeons por estágio.
4. Boss especial por mapa.
5. Sistema offline idle.
6. Save em banco de dados.
7. Skills passivas e árvore de talentos.
8. Ranking e guildas.
