const fs = require('fs');
const path = require('path');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'socket-events.log');
function ensure(){ if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR,{recursive:true}); }
function safePayload(payload){ try { return JSON.stringify(payload, (k,v)=> k.toLowerCase().includes('password') ? '***' : v).slice(0,800); } catch { return '<unserializable>'; } }
class SocketEventLogger {
  static attach(socket, getPlayer){
    socket.onAny((event, payload)=>{
      if(['combatTick','enemyUpdate','gameState'].includes(event)) return;
      const p = getPlayer ? getPlayer() : null;
      const line = `[${new Date().toISOString()}] ${socket.id} ${p&&p.nome?p.nome:'?'} -> ${event} ${safePayload(payload)}\n`;
      try { ensure(); fs.appendFileSync(LOG_FILE, line, 'utf8'); } catch {}
      if(process.env.DEBUG_SOCKET === '1') console.log(line.trim());
    });
  }
  static path(){ return LOG_FILE; }
}
module.exports = SocketEventLogger;
