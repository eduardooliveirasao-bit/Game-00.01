const LootManager = require('./LootManager');

const DEFAULT_CAPACITY = 56;
const SLOT_ORDER = ['arma', 'anel', 'colar', 'ornamento'];
const RARITY_WEIGHT = { comum:1, raro:2, 'épico':3, 'lendário':4, 'mítico':5, boss:6 };
function now(){ return Date.now(); }
function safeList(player){ player.inventario = Array.isArray(player.inventario) ? player.inventario : []; return player.inventario; }
function score(item){ return (RARITY_WEIGHT[item.raridade] || 0) * 100000 + (item.powerScore || LootManager.scoreItem(item) || 0); }

class SlotInventoryManager {
  static normalize(player) {
    player.bag = player.bag || { capacity: DEFAULT_CAPACITY, slots: [], lastSortAt: 0 };
    player.bag.capacity = Math.max(24, Math.floor(player.bag.capacity || DEFAULT_CAPACITY));
    const bagSlots = Array.from({ length: player.bag.capacity }, () => null);
    const used = new Set();
    for (const item of safeList(player)) {
      if (!item || !item.id) continue;
      let slot = Number.isInteger(item.slotIndex) ? item.slotIndex : -1;
      if (slot < 0 || slot >= bagSlots.length || used.has(slot)) {
        slot = bagSlots.findIndex((v, idx) => !used.has(idx) && v == null);
      }
      if (slot >= 0) {
        item.slotIndex = slot;
        bagSlots[slot] = LootManager.enrichItem(item);
        used.add(slot);
      }
    }
    player.bag.slots = bagSlots;
    return player.bag;
  }

  static publicBag(player) {
    const bag = this.normalize(player);
    return { capacity: bag.capacity, used: bag.slots.filter(Boolean).length, slots: bag.slots.map((item, i) => item ? LootManager.enrichItem({ ...item, slotIndex: i }) : null) };
  }

  static sort(player) {
    const bag = this.normalize(player);
    const items = bag.slots.filter(Boolean).sort((a, b) => {
      const at = SLOT_ORDER.indexOf(a.slot || a.tipo || '');
      const bt = SLOT_ORDER.indexOf(b.slot || b.tipo || '');
      const ag = at < 0 ? 99 : at, bg = bt < 0 ? 99 : bt;
      return ag - bg || score(b) - score(a) || String(a.nome).localeCompare(String(b.nome));
    });
    for (let i = 0; i < items.length; i++) items[i].slotIndex = i;
    for (const item of safeList(player)) {
      const found = items.find(i => i.id === item.id);
      if (found) item.slotIndex = found.slotIndex;
    }
    player.bag.lastSortAt = now();
    return { ok:true, bag: this.publicBag(player) };
  }

  static move(player, fromSlot, toSlot) {
    const bag = this.normalize(player);
    fromSlot = Math.floor(Number(fromSlot)); toSlot = Math.floor(Number(toSlot));
    if (fromSlot < 0 || toSlot < 0 || fromSlot >= bag.capacity || toSlot >= bag.capacity) return { ok:false, reason:'Slot inválido.' };
    const a = bag.slots[fromSlot], b = bag.slots[toSlot];
    if (!a && !b) return { ok:false, reason:'Nada para mover.' };
    if (a) a.slotIndex = toSlot;
    if (b) b.slotIndex = fromSlot;
    for (const item of safeList(player)) {
      if (a && item.id === a.id) item.slotIndex = toSlot;
      else if (b && item.id === b.id) item.slotIndex = fromSlot;
    }
    return { ok:true, bag: this.publicBag(player) };
  }

  static enhance(player, itemId) {
    const item = safeList(player).find(i => i.id === itemId);
    if (!item) return { ok:false, reason:'Item não encontrado.' };
    if (item.locked) return { ok:false, reason:'Item protegido. Desbloqueie antes de fortalecer.' };
    const level = Math.max(0, Math.floor(item.upgradeLevel || item.enhanceLevel || 0));
    if (level >= 20) return { ok:false, reason:'Fortalecimento máximo +20.' };
    const costGold = 250 + level * 180 + (RARITY_WEIGHT[item.raridade] || 1) * 220;
    const costGems = level >= 10 ? Math.floor((level - 8) / 2) : 0;
    if ((player.ouro || 0) < costGold) return { ok:false, reason:'Ouro insuficiente.' };
    if ((player.gemas || 0) < costGems) return { ok:false, reason:'Gemas insuficientes.' };
    player.ouro -= costGold;
    player.gemas -= costGems;
    player.cashGems = player.gemas;
    item.upgradeLevel = level + 1;
    item.enhanceLevel = item.upgradeLevel;
    item.enhancedAt = now();
    const enriched = LootManager.enrichItem(item);
    if (player.equipados && player.equipados[enriched.slot] && player.equipados[enriched.slot].id === enriched.id) player.equipados[enriched.slot] = { ...enriched };
    return { ok:true, item: enriched, costGold, costGems, bag: this.publicBag(player) };
  }

  static expand(player, amount = 8) {
    this.normalize(player);
    const cost = 2500 + Math.floor((player.bag.capacity - DEFAULT_CAPACITY) / 8) * 1800;
    if ((player.ouro || 0) < cost) return { ok:false, reason:'Ouro insuficiente para expandir a bolsa.' };
    player.ouro -= cost;
    player.bag.capacity = Math.min(120, player.bag.capacity + Math.max(1, Math.floor(amount)));
    return { ok:true, capacity: player.bag.capacity, cost, bag: this.publicBag(player) };
  }
}

module.exports = SlotInventoryManager;
