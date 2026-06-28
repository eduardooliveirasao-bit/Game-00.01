from __future__ import annotations

from dataclasses import dataclass, field
from heapq import heappop, heappush
from random import random
from typing import List


@dataclass
class AttributeSet:
    hp: int
    atk: int
    defense: int
    speed: int
    crit: float
    evasion: float

    def damage_against(self, target: "AttributeSet", multiplier: float = 1.0) -> dict:
        if random() < target.evasion:
            return {"damage": 0, "evaded": True, "crit": False}

        raw = max(1, self.atk * multiplier - target.defense * 0.45)
        crit = random() < self.crit
        if crit:
            raw *= 1.75
        return {"damage": int(raw), "evaded": False, "crit": crit}


@dataclass(order=True)
class QueuedSkill:
    ready_at: float
    priority: int
    skill_id: str = field(compare=False)
    cooldown: float = field(compare=False)
    multiplier: float = field(compare=False)
    mana_cost: int = field(compare=False, default=0)


class SkillQueue:
    def __init__(self):
        self._queue: List[QueuedSkill] = []

    def add_skill(self, skill: QueuedSkill) -> None:
        heappush(self._queue, skill)

    def tick(self, now: float, caster: AttributeSet, target: AttributeSet, mana: int) -> list[dict]:
        events = []
        ready = []

        while self._queue and self._queue[0].ready_at <= now:
            skill = heappop(self._queue)
            if mana >= skill.mana_cost:
                result = caster.damage_against(target, skill.multiplier)
                events.append({
                    "type": "skill",
                    "skillId": skill.skill_id,
                    "damage": result["damage"],
                    "crit": result["crit"],
                    "evaded": result["evaded"],
                })
                skill.ready_at = now + max(0.35, skill.cooldown * (100 / max(25, caster.speed)))
            else:
                skill.ready_at = now + 1.0
            ready.append(skill)

        for skill in ready:
            heappush(self._queue, skill)

        return events