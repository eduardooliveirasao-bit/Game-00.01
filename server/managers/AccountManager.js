
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GAME_CLASSES } = require('../../shared/classes.js');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ACCOUNTS_FILE)) fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify({ accounts: {}, nickIndex: {} }, null, 2), 'utf8');
}

function readAll() {
  ensureStore();
  try {
    const raw = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8') || '{}');
    return { accounts: raw.accounts || {}, nickIndex: raw.nickIndex || {} };
  } catch (err) {
    return { accounts: {}, nickIndex: {} };
  }
}

function writeAll(data) {
  ensureStore();
  const tmp = ACCOUNTS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ accounts: data.accounts || {}, nickIndex: data.nickIndex || {} }, null, 2), 'utf8');
  fs.renameSync(tmp, ACCOUNTS_FILE);
}

function normLogin(login) {
  return String(login || '').trim().toLowerCase();
}

function normNick(nick) {
  return String(nick || '').trim().toLowerCase();
}

function makeHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(String(password || ''), salt, 120000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verify(password, account) {
  if (!account || !account.salt || !account.passwordHash) return false;
  const { hash } = makeHash(password, account.salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(account.passwordHash, 'hex'));
  } catch (err) {
    return false;
  }
}

function publicAccount(account) {
  if (!account) return null;
  return {
    login: account.login,
    nick: account.nick,
    saveId: account.saveId,
    isGM: !!account.isGM,
    createdAt: account.createdAt,
    lastLoginAt: account.lastLoginAt
  };
}

class AccountManager {
  static ensureDefaultGM(SaveManager, createPlayerFn) {
    const data = readAll();
    const gmKey = 'gm';
    if (data.accounts[gmKey]) return data.accounts[gmKey];

    const saveId = SaveManager.createId();
    const { salt, hash } = makeHash('GM123');
    const account = {
      login: 'GM',
      loginKey: gmKey,
      nick: 'GM-Eduardo',
      nickKey: normNick('GM-Eduardo'),
      saveId,
      passwordHash: hash,
      salt,
      isGM: true,
      createdAt: Date.now(),
      lastLoginAt: 0
    };
    data.accounts[gmKey] = account;
    data.nickIndex[account.nickKey] = gmKey;
    writeAll(data);

    const player = createPlayerFn({ id: 'gm-seed' });
    player.saveId = saveId;
    player.accountLogin = 'GM';
    player.isGM = true;
    player.nome = account.nick;
    player.classeId = 'mago';
    player.nivel = 20;
    player.level = 20;
    player.xp = 0;
    player.ouro = 500000;
    player.gemas = 50000;
    player.cashGems = 50000;
    player.hp = 1000;
    player.maxHp = 1000;
    player.mana = 1000;
    player.maxMana = 1000;
    player.mount = { id: 'dragao_mirim', level: 10 };
    player.mountCollection = [
      { id:'lobo_cristalino', level:10, active:false, unlockedAt:Date.now() },
      { id:'grifo_dourado', level:10, active:false, unlockedAt:Date.now() },
      { id:'dragao_mirim', level:10, active:true, unlockedAt:Date.now() }
    ];
    player.stats = player.stats || {};
    player.stats.gmSeed = true;
    SaveManager.save(player);
    return account;
  }

  static create({ login, password, nick, classeId, SaveManager, createPlayerFn }) {
    const loginClean = String(login || '').trim();
    const nickClean = String(nick || '').trim();
    const loginKey = normLogin(loginClean);
    const nickKey = normNick(nickClean);

    if (!/^[a-zA-Z0-9_.-]{3,18}$/.test(loginClean)) return { ok: false, reason: 'Login deve ter 3 a 18 caracteres e usar letras, números, ponto, hífen ou underline.' };
    if (String(password || '').length < 4) return { ok: false, reason: 'Senha precisa ter pelo menos 4 caracteres.' };
    if (!/^[a-zA-Z0-9À-ÿ _.-]{3,18}$/.test(nickClean)) return { ok: false, reason: 'Nick deve ter 3 a 18 caracteres.' };
    if (!GAME_CLASSES[classeId]) return { ok: false, reason: 'Classe inválida.' };

    const data = readAll();
    if (data.accounts[loginKey]) return { ok: false, reason: 'Esse login já existe.' };
    if (data.nickIndex[nickKey]) return { ok: false, reason: 'Esse nick já está em uso por outro jogador.' };

    const saveId = SaveManager.createId();
    const { salt, hash } = makeHash(password);
    const account = {
      login: loginClean,
      loginKey,
      nick: nickClean,
      nickKey,
      saveId,
      passwordHash: hash,
      salt,
      isGM: loginKey === 'gm',
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };

    data.accounts[loginKey] = account;
    data.nickIndex[nickKey] = loginKey;
    writeAll(data);

    const player = createPlayerFn({ id: 'seed-' + saveId });
    player.saveId = saveId;
    player.accountLogin = account.login;
    player.isGM = account.isGM;
    player.nome = nickClean;
    player.classeId = classeId;
    player.gemas = account.isGM ? 50000 : 10;
    player.cashGems = player.gemas;
    player.ouro = account.isGM ? 500000 : 150;
    player.mount = { id: 'lobo_cristalino', level: 1 };
    player.mountCollection = [{ id:'lobo_cristalino', level:1, active:true, unlockedAt:Date.now() }];
    if (account.isGM) {
      player.nivel = 20;
      player.level = 20;
      player.mount = { id: 'dragao_mirim', level: 10 };
    player.mountCollection = [
      { id:'lobo_cristalino', level:10, active:false, unlockedAt:Date.now() },
      { id:'grifo_dourado', level:10, active:false, unlockedAt:Date.now() },
      { id:'dragao_mirim', level:10, active:true, unlockedAt:Date.now() }
    ];
    }
    SaveManager.save(player);
    return { ok: true, account: publicAccount(account), saveId };
  }

  static login(login, password) {
    const data = readAll();
    const typed = String(login || '').trim();
    let account = data.accounts[normLogin(typed)];

    // V91: a tela mostra "NOME DO PERSONAGEM", então aceitamos tanto login quanto nick.
    // Isso evita o jogador ficar preso na tela de login ao digitar o nome do herói.
    if (!account) {
      const ownerLoginKey = data.nickIndex[normNick(typed)];
      if (ownerLoginKey) account = data.accounts[ownerLoginKey];
    }

    if (!account || !verify(password, account)) return { ok: false, reason: 'Login/nick ou senha inválidos.' };
    account.lastLoginAt = Date.now();
    data.accounts[account.loginKey] = account;
    writeAll(data);
    return { ok: true, account: publicAccount(account), saveId: account.saveId };
  }

  static isNickTaken(nick, exceptLogin) {
    const data = readAll();
    const owner = data.nickIndex[normNick(nick)];
    return !!owner && owner !== normLogin(exceptLogin);
  }

  static changeNick(login, newNick) {
    const data = readAll();
    const key = normLogin(login);
    const account = data.accounts[key];
    if (!account) return { ok: false, reason: 'Conta não encontrada.' };
    const nickClean = String(newNick || '').trim();
    const nickKey = normNick(nickClean);
    if (!/^[a-zA-Z0-9À-ÿ _.-]{3,18}$/.test(nickClean)) return { ok: false, reason: 'Nick deve ter 3 a 18 caracteres.' };
    if (data.nickIndex[nickKey] && data.nickIndex[nickKey] !== key) return { ok: false, reason: 'Esse nick já está em uso.' };
    if (account.nickKey) delete data.nickIndex[account.nickKey];
    account.nick = nickClean;
    account.nickKey = nickKey;
    data.nickIndex[nickKey] = key;
    data.accounts[key] = account;
    writeAll(data);
    return { ok: true, account: publicAccount(account) };
  }

  static listPublic() {
    const data = readAll();
    return Object.values(data.accounts).map(publicAccount);
  }
}

module.exports = AccountManager;
