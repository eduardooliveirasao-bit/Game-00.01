from dataclasses import dataclass
from math import pow
from time import time


@dataclass
class OfflineSnapshot:
    stage: int
    power: int
    kills_per_minute: float
    last_online_at: float


def calculate_offline_reward(snapshot: OfflineSnapshot, now: float | None = None, cap_hours: int = 8) -> dict:
    now = now or time()
    seconds = max(0, now - snapshot.last_online_at)
    capped_seconds = min(seconds, cap_hours * 3600)

    stage_multiplier = pow(1.055, snapshot.stage)
    efficiency = min(1.0, max(0.15, snapshot.kills_per_minute / 25.0))
    minutes = capped_seconds / 60.0

    xp_per_min = 18 * stage_multiplier * efficiency
    gold_per_min = 9 * stage_multiplier * efficiency

    return {
        "seconds": int(capped_seconds),
        "xp": int(xp_per_min * minutes),
        "gold": int(gold_per_min * minutes),
        "efficiency": efficiency,
    }