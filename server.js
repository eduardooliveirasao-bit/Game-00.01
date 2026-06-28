const express = require('express');
const { Server } = require('socket.io');
const { GAME_CLASSES, XP_TABLE, MONSTERS } = require('./shared/classes.js');
const app = express();
const server = require('http').createServer(app);
const io = new Server(server);
app.use(express.static('public'));
app.use('/shared', express.static('shared'));
let players = {};
let monster = { ...MONSTERS[0], hp: MONSTERS[0].hpBase };
setInterval(() => {
  for (let id in players) {
    let p = players[id];
    if (!p.classeId) continue;
    monster.hp -= (5 + (p.nivel * 2));
    if (monster.hp <= 0) {
      p.xp += monster.xp;
      if (p.xp >= (XP_TABLE[p.nivel + 1] || Infinity)) p.nivel = Math.min(p.nivel + 1, 80);
      monster = { ...MONSTERS[Math.floor(Math.random()*MONSTERS.length)], hp: 100 };
    }
  }
  io.emit('gameUpdate', { players, monster });
}, 1000);
server.listen(3000, () => console.log('Servidor em http://localhost:3000'));
