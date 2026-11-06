"""Paperboat domain state: 2D sailing aerohydrodynamics, islands, treasure, and entities."""

import math
import random
from paperboat import DomainState

WIND_DIR = math.radians(315)  # 315° Northwest
WIND_SPEED = 14.0             # Knots
NOGO_BAND = math.radians(42)  # In-Irons threshold

# Sequence of treasure coordinates for endless exploration
TREASURE_WAYPOINTS = [
    (5.5, -8.0),
    (-6.0, 5.0),
    (3.5, 9.5),
    (-7.5, -10.0),
    (8.0, -3.0),
    (0.0, -12.0),
]


class Island:
    def __init__(self, x: float, z: float, r: float):
        self.x, self.z, self.r = x, z, r


class PaperboatGame(DomainState):
    def __init__(self, rng: random.Random | None = None) -> None:
        self.rng = rng or random.Random(42)
        # Ship state: x (m), z (m), heading (rad), speed (kt), yaw_rate (rad/s), heel (deg)
        self.x, self.z = -4.0, 7.0
        self.heading = math.radians(240)
        self.speed = 9.0
        self.yaw_rate = 0.0
        self.heel = -4.2
        self.sail_angle = 42.0  # Degrees
        self.rudder = 0.1       # [-1.0 .. 1.0]
        self.sails_dropped = False

        # Environment & targets
        self.wind_dir = WIND_DIR
        self.wind_speed = WIND_SPEED
        self.target_idx = 0
        self.chest_x, self.chest_z = TREASURE_WAYPOINTS[0]
        self.chest_collected = False
        self.coins_collected = 0
        self.chests_retrieved = 0
        self.crashed = False

        self.islands = [
            Island(7.5, 3.0, 4.8),
            Island(-8.5, -3.5, 3.8)
        ]

    def apparent_wind_angle(self) -> float:
        """Angle between true wind and boat heading, normalised to [-pi, pi]."""
        diff = self.wind_dir - self.heading
        while diff > math.pi:
            diff -= 2 * math.pi
        while diff < -math.pi:
            diff += 2 * math.pi
        return diff

    def is_in_nogo(self) -> bool:
        """True if boat heading is within the No-Go zone of the oncoming wind."""
        return abs(self.apparent_wind_angle()) < NOGO_BAND

    def dist_to_nearest_shore(self) -> float:
        """Distance from ship center to nearest island shoreline."""
        min_dist = 999.0
        for isl in self.islands:
            d = math.hypot(self.x - isl.x, self.z - isl.z) - isl.r
            if d < min_dist:
                min_dist = d
        return max(0.0, min_dist)

    def advance(self, dt: float) -> str | None:
        """Advance physics by dt. Softly deflects off shoreline reefs; spawns next treasure."""
        app_angle = self.apparent_wind_angle()
        in_irons = abs(app_angle) < NOGO_BAND

        # Aerodynamic lift calculation
        target_speed = 1.0 if (in_irons or self.sails_dropped) else (self.wind_speed * 0.72 * math.sin(abs(app_angle)))
        self.speed += (target_speed - self.speed) * dt * 1.5

        # Yaw steering dynamics with speed-dependent rudder torque and damping
        yaw_torque = self.rudder * (self.speed / 10.0) * 3.2
        self.yaw_rate += (yaw_torque - self.yaw_rate * 3.0) * dt
        self.heading += self.yaw_rate * dt

        # Translation in 2D horizontal plane (X, Z)
        self.x += math.cos(self.heading) * self.speed * dt * 0.45
        self.z += math.sin(self.heading) * self.speed * dt * 0.45

        # Dynamic heel roll
        self.heel = math.sin(app_angle) * (self.speed / 10.0) * 12.0

        # Island collision deflection: glancing bump rather than game-ending crash
        for isl in self.islands:
            dist = math.hypot(self.x - isl.x, self.z - isl.z)
            if dist < (isl.r - 0.4):
                angle = math.atan2(self.z - isl.z, self.x - isl.x)
                self.x = isl.x + math.cos(angle) * (isl.r - 0.3)
                self.z = isl.z + math.sin(angle) * (isl.r - 0.3)
                self.heading = angle
                self.speed = max(1.5, self.speed * 0.5)
                self.yaw_rate = 0.0

        # Treasure chest collection & infinite respawn loop
        event = None
        if math.hypot(self.x - self.chest_x, self.z - self.chest_z) < 2.4:
            self.chests_retrieved += 1
            self.coins_collected += 25
            self.chest_collected = True
            event = f"treasure retrieved! Mission complete with {self.coins_collected} coins"
            # Cycle to next endless exploration waypoint
            self.target_idx = (self.target_idx + 1) % len(TREASURE_WAYPOINTS)
            self.chest_x, self.chest_z = TREASURE_WAYPOINTS[self.target_idx]

        return event

    def step(self, ctx) -> str | None:
        """Engine step hook called every clock step. Infinite gameplay runs indefinitely."""
        event = self.advance(ctx.dt)
        if event:
            ctx.log(event, "info")
        # Always return None so gameplay proceeds infinitely
        return None

    def summary(self) -> str | None:
        return f"endless sailing voyage: Chests: {self.chests_retrieved}, Coins: {self.coins_collected}, Speed: {self.speed:.1f} kt"

    def entities(self) -> list[dict]:
        """Full scene entity list for Station view."""
        return [
            {"id": "ship", "shape": "box", "pos": [self.x, 0.45, self.z], "rot": [0, -self.heading, self.heel], "size": [3.0, 1.2, 1.4], "color": "#ffffff"},
            {"id": "chest", "shape": "box", "pos": [self.chest_x, 0.35, self.chest_z], "size": [1.4, 0.9, 0.9], "color": "#fbbf24"},
            *self.patch()
        ]

    def patch(self) -> list[dict]:
        """Patched dynamic entities sent during clocked runs."""
        return [
            {"id": "ship", "pos": [self.x, 0.45, self.z], "rot": [0, -self.heading, self.heel],
             "speed": self.speed, "sail_angle": self.sail_angle, "rudder": self.rudder,
             "coins": self.coins_collected, "chest_collected": self.chest_collected,
             "wind_dir": self.wind_dir, "wind_speed": self.wind_speed},
            {"id": "chest", "pos": [self.chest_x, 0.35, self.chest_z], "collected": self.chest_collected}
        ]
