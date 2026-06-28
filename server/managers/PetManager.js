const { PETS } = require('../../shared/classes.js');

class PetManager {
  static ensure(player) {
    player.pets = player.pets || {
      owned: [
        { id: 'fogo_fenix', level: 1 },
        { id: 'luz_serafim', level: 1 }
      ],
      equipped: ['fogo_fenix', 'luz_serafim']
    };
    player.pets.owned = player.pets.owned || [];
    player.pets.equipped = player.pets.equipped || [];
    return player.pets;
  }

  static publicPets(player) {
    const pets = this.ensure(player);
    return {
      owned: pets.owned.map((p) => ({ ...PETS[p.id], level: p.level || 1 })),
      equipped: pets.equipped.map((id) => {
        const owned = pets.owned.find((p) => p.id === id) || { id, level: 1 };
        return { ...PETS[id], level: owned.level || 1 };
      }).filter((p) => p && p.id),
      synergy: this.getSynergy(player)
    };
  }

  static getSynergy(player) {
    const pets = this.ensure(player);
    const counts = {};
    for (const id of pets.equipped) {
      const pet = PETS[id];
      if (!pet) continue;
      counts[pet.elemento] = (counts[pet.elemento] || 0) + 1;
    }
    const bonuses = [];
    for (const [elemento, count] of Object.entries(counts)) {
      if (count >= 2) {
        bonuses.push({
          elemento,
          count,
          nome: `Sinergia ${elemento}`,
          danoPct: elemento === 'fogo' ? 0.10 : 0.05,
          hpPct: elemento === 'natureza' ? 0.08 : 0,
          critico: elemento === 'sombra' ? 6 : 0
        });
      }
    }
    return bonuses;
  }

  static getBonuses(player) {
    const pets = this.ensure(player);
    const bonus = { ataquePct: 0, defesaPct: 0, hpPct: 0, manaPct: 0, critico: 0, evasao: 0, danoPct: 0 };
    for (const owned of pets.owned) {
      if (!pets.equipped.includes(owned.id)) continue;
      const pet = PETS[owned.id];
      if (!pet) continue;
      const lvlMul = 1 + ((owned.level || 1) - 1) * 0.08;
      const b = pet.bonus || {};
      bonus.ataquePct += (b.ataquePct || 0) * lvlMul;
      bonus.defesaPct += (b.defesaPct || 0) * lvlMul;
      bonus.hpPct += (b.hpPct || 0) * lvlMul;
      bonus.manaPct += (b.manaPct || 0) * lvlMul;
      bonus.critico += Math.floor((b.critico || 0) * lvlMul);
      bonus.evasao += Math.floor((b.evasao || 0) * lvlMul);
    }
    for (const syn of this.getSynergy(player)) {
      bonus.danoPct += syn.danoPct || 0;
      bonus.hpPct += syn.hpPct || 0;
      bonus.critico += syn.critico || 0;
    }
    return bonus;
  }

  static acquire(player, petId) {
    if (!PETS[petId]) return { ok: false, reason: 'Pet inválido.' };
    const pets = this.ensure(player);
    const owned = pets.owned.find((p) => p.id === petId);
    if (owned) owned.level += 1;
    else pets.owned.push({ id: petId, level: 1 });
    if (pets.equipped.length < 3 && !pets.equipped.includes(petId)) pets.equipped.push(petId);
    return { ok: true, pet: { ...PETS[petId], level: (owned && owned.level) || 1 }, pets: this.publicPets(player) };
  }

  static levelUp(player, petId) {
    const pets = this.ensure(player);
    const owned = pets.owned.find((p) => p.id === petId);
    if (!owned) return { ok: false, reason: 'Você ainda não possui este pet.' };
    const cost = 120 + owned.level * 80;
    if ((player.ouro || 0) < cost) return { ok: false, reason: 'Ouro insuficiente para treinar o pet.' };
    player.ouro -= cost;
    owned.level += 1;
    return { ok: true, pet: { ...PETS[petId], level: owned.level }, cost, pets: this.publicPets(player) };
  }

  static powerBonus(player) {
    const b = this.getBonuses(player);
    return Math.floor((b.ataquePct + b.defesaPct + b.hpPct + b.manaPct + b.danoPct) * 1200 + b.critico * 8 + b.evasao * 6);
  }
}
module.exports = PetManager;
