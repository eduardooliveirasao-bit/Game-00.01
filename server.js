const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GAME_CLASSES, LEVEL_CAP } = require('./shared/classes.js');
const LevelManager = require('./server/managers/LevelManager');
const MonsterManager = require('./server/managers/MonsterManager');
const CombatManager = require('./server/managers/CombatManager');

const PORT = process.env.PORT || 3000;
const TICK_RATE_MS = 1000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static('public'));
app.use('/shared', express.static('shared'));

const players = {};
const monsterManager = new MonsterManager();

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

function createPlayer(socket) {
  const player = {
    id: socket.id,
    nome: `Aventureiro-${randomSuffix()}`,
    classeId: null,
    nivel: 1,
    level: 1,
    xp: 0,
    xpToNext: 0,
    xpPercent: 0,
    hp: 100,
    maxHp: 100,
    asaNivel: 1,
    asaNome: 'Asas Iniciais',
    ouro: 0,
    cooldowns: {},
    posicao: {
      x: 70 + Math.floor(Math.random() * 120),
      y: 170 + Math.floor(Math.random() * 120)
    },
    createdAt: Date.now(),
    lastAttackAt: 0
  };

  return LevelManager.syncProgressFields(player);
}

function publicPlayer(player) {
  return {
    id: player.id,
    nome: player.nome,
    classeId: player.classeId,
    nivel: player.nivel,
    level: player.level,
    xp: player.xp,
    xpToNext: player.xpToNext,
    xpPercent: player.xpPercent,
    hp: player.hp,
    maxHp: player.maxHp,
    asaNivel: player.asaNivel,
    asaNome: player.asaNome,
    ouro: player.ouro,
    posicao: player.posicao
  };
}

function publicPlayersList() {
  return Object.values(players).map(publicPlayer);
}

function emitEnemyUpdate() {
  io.emit('enemyUpdate', monsterManager.getPublicMonster());
}

function rewardIfEnemyDied(player, combatEvent) {
  if (!combatEvent || !combatEvent.monsterDied) return;

  const xpReward = combatEvent.result.xpReward;
  const progress = CombatManager.grantKillRewards(player, combatEvent);

  io.emit('enemyDied', {
    killerId: player.id,
    killerName: player.nome,
    xpReward,
    deadMonster: combatEvent.result.deadMonster,
    nextMonster: combatEvent.result.nextMonster,
    killCount: combatEvent.result.killCount,
    progress
  });

  io.emit('playerUpdated', publicPlayer(player));
  emitEnemyUpdate();
}

io.on('connection', (socket) => {
  const player = createPlayer(socket);
  players[socket.id] = player;

  socket.emit('init', {
    you: publicPlayer(player),
    players: publicPlayersList(),
    monster: monsterManager.getPublicMonster(),
    levelCap: LEVEL_CAP
  });

  socket.broadcast.emit('playerJoined', publicPlayer(player));
  emitEnemyUpdate();

  socket.on('selectClass', (data = {}) => {
    const classeId = data.classeId;
    const classe = GAME_CLASSES[classeId];
    if (!classe) {
      socket.emit('errorMsg', 'Classe inválida.');
      return;
    }

    player.classeId = classeId;
    player.hp = classe.baseStats.maxHp;
    player.maxHp = classe.baseStats.maxHp;
    LevelManager.syncProgressFields(player);

    io.emit('playerUpdated', publicPlayer(player));
  });

  socket.on('useAbility', (data = {}) => {
    const now = Date.now();
    const combatEvent = CombatManager.useAbility(
      player,
      data.habilidadeId,
      monsterManager,
      now
    );

    if (!combatEvent.ok) {
      if (combatEvent.restanteMs) {
        socket.emit('cooldownRejected', { restanteMs: combatEvent.restanteMs });
      } else {
        socket.emit('errorMsg', combatEvent.reason);
      }
      return;
    }

    io.emit('abilityUsed', {
      playerId: player.id,
      classeId: player.classeId,
      habilidadeId: combatEvent.habilidadeId,
      habilidadeNome: combatEvent.habilidadeNome,
      visual: combatEvent.visual,
      cooldown: combatEvent.cooldown,
      damage: combatEvent.damage,
      isCrit: combatEvent.isCrit
    });

    io.emit('combatTick', {
      attacks: [combatEvent],
      monster: monsterManager.getPublicMonster(),
      serverTime: now
    });

    rewardIfEnemyDied(player, combatEvent);
    emitEnemyUpdate();
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerLeft', { id: socket.id });
    io.emit('gameState', publicPlayersList());
  });
});

setInterval(() => {
  const attacks = [];

  for (const player of Object.values(players)) {
    if (!player.classeId) continue;

    const combatEvent = CombatManager.basicAttack(player, monsterManager);
    if (!combatEvent) continue;

    player.lastAttackAt = Date.now();
    attacks.push(combatEvent);
    rewardIfEnemyDied(player, combatEvent);
  }

  io.emit('gameState', publicPlayersList());

  if (attacks.length > 0) {
    io.emit('combatTick', {
      attacks,
      monster: monsterManager.getPublicMonster(),
      serverTime: Date.now()
    });
    emitEnemyUpdate();
  }
}, TICK_RATE_MS);

server.listen(PORT, () => {
  console.log(`Servidor em http://localhost:${PORT}`);
});
