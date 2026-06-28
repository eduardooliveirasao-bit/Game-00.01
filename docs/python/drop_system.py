from __future__ import annotations

from dataclasses import dataclass, field
from random import randint, random, choices
from typing import Dict, List, Optional


STAT_WEIGHTS = {
    "arma": ["ATK", "CRIT", "SPEED"],
    "anel": ["CRIT", "ATK", "EVASION"],
    "colar": ["HP", "DEF", "EVASION"],
    "ornamento": ["DEF", "HP", "SPEED", "CRIT"],
}

RARITY = {
    0: {"name": "Comum", "mult": 1.00, "rolls": 1, "weight": 600},
    1: {"name": "Raro", "mult": 1.25, "rolls": 2, "weight": 280},
    2: {"name": "Épico", "mult": 1.65, "rolls": 3, "weight": 95},
    3: {"name": "Lendário", "mult": 2.20, "rolls": 4, "weight": 25},
}


@dataclass
class ItemDefinition:
    item_def_id: int
    code: str
    name: str
    slot: str
    class_id: Optional[str]
    required_level: int
    base_stats: Dict[str, int]


@dataclass
class PlayerItem:
    player_item_id: int
    item_def_id: int
    name: str
    slot: str
    rarity: int
    roll_quality: int
    fixed_stats: Dict[str, int]
    rolled_stats: Dict[str, int]
    power_score: int
    affixes: List[str] = field(default_factory=list)


class DropManager:
    def __init__(self, item_repository):
        self.item_repository = item_repository

    def roll_rarity(self, stage: int, is_boss: bool = False) -> int:
        weights = []
        for rarity, row in RARITY.items():
            boost = 1.0 + (stage / 80.0) * rarity
            if is_boss and rarity >= 2:
                boost *= 2.0
            weights.append(row["weight"] * boost)
        return choices(list(RARITY.keys()), weights=weights, k=1)[0]

    def roll_item(self, player_id: int, class_id: str, stage: int, is_boss: bool = False) -> PlayerItem:
        base: ItemDefinition = self.item_repository.pick_base_item(class_id=class_id, stage=stage)
        rarity = self.roll_rarity(stage, is_boss)
        quality = max(1, min(100, randint(45 + rarity * 8, 85 + rarity * 5)))

        fixed = {
            stat: int(value * (1 + stage * 0.035))
            for stat, value in base.base_stats.items()
        }

        rolled = {key: 0 for key in ["HP", "ATK", "DEF", "SPEED", "CRIT", "EVASION"]}
        affixes = []
        for _ in range(RARITY[rarity]["rolls"]):
            stat = choices(STAT_WEIGHTS.get(base.slot, list(rolled.keys())), k=1)[0]
            value = int(randint(2, 9) * RARITY[rarity]["mult"] * (quality / 100) * (1 + stage * 0.04))
            if stat == "HP":
                value *= 8
            rolled[stat] += max(1, value)
            affixes.append(f"+{value} {stat}")

        power = calculate_power_level({**fixed}, rolled, rarity)
        return PlayerItem(
            player_item_id=0,
            item_def_id=base.item_def_id,
            name=base.name,
            slot=base.slot,
            rarity=rarity,
            roll_quality=quality,
            fixed_stats=fixed,
            rolled_stats=rolled,
            power_score=power,
            affixes=affixes,
        )


def calculate_power_level(fixed_stats: Dict[str, int], rolled_stats: Dict[str, int], rarity: int) -> int:
    merged = dict(fixed_stats)
    for key, value in rolled_stats.items():
        merged[key] = merged.get(key, 0) + value

    return int(
        merged.get("ATK", 0) * 6
        + merged.get("DEF", 0) * 4
        + merged.get("CRIT", 0) * 7
        + merged.get("SPEED", 0) * 5
        + merged.get("EVASION", 0) * 6
        + merged.get("HP", 0) * 0.55
        + rarity * 40
    )


def suggest_auto_equip(new_item: PlayerItem, equipped_item: Optional[PlayerItem]) -> dict:
    current_power = equipped_item.power_score if equipped_item else 0
    delta = new_item.power_score - current_power
    return {
        "slot": new_item.slot,
        "is_better": delta > 0,
        "delta": delta,
        "new_power": new_item.power_score,
        "current_power": current_power,
    }