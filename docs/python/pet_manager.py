from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Dict, List


@dataclass
class PetDefinition:
    pet_id: str
    name: str
    element: str
    base_bonus: Dict[str, float]


@dataclass
class PlayerPet:
    pet_id: str
    level: int


class PetManager:
    def __init__(self, pet_catalog: Dict[str, PetDefinition]):
        self.pet_catalog = pet_catalog

    def acquire(self, owned: List[PlayerPet], pet_id: str) -> List[PlayerPet]:
        for pet in owned:
            if pet.pet_id == pet_id:
                pet.level += 1
                return owned
        owned.append(PlayerPet(pet_id=pet_id, level=1))
        return owned

    def get_synergy(self, equipped: List[PlayerPet]) -> Dict[str, float]:
        elements = Counter(self.pet_catalog[p.pet_id].element for p in equipped if p.pet_id in self.pet_catalog)
        bonus = {"damage_pct": 0.0, "hp_pct": 0.0, "crit": 0.0}

        for element, count in elements.items():
            if count < 2:
                continue
            if element == "fire":
                bonus["damage_pct"] += 0.10
            elif element == "nature":
                bonus["hp_pct"] += 0.10
            elif element == "shadow":
                bonus["crit"] += 0.06
            else:
                bonus["damage_pct"] += 0.05

        return bonus

    def aggregate_bonus(self, equipped: List[PlayerPet]) -> Dict[str, float]:
        total = {"atk_pct": 0.0, "def_pct": 0.0, "hp_pct": 0.0, "crit": 0.0, "damage_pct": 0.0}

        for player_pet in equipped:
            definition = self.pet_catalog.get(player_pet.pet_id)
            if not definition:
                continue
            level_multiplier = 1 + (player_pet.level - 1) * 0.08
            for key, value in definition.base_bonus.items():
                total[key] = total.get(key, 0.0) + value * level_multiplier

        synergy = self.get_synergy(equipped)
        for key, value in synergy.items():
            total[key] = total.get(key, 0.0) + value

        return total