"""
Rules engine for threshold-based alerts and safety interlocks.
Evaluates incoming sensor readings against configurable rules.
"""

from dataclasses import dataclass
from typing import List, Optional

from backend.models import SensorReading, SensorType, AlertSeverity


@dataclass
class Rule:
    name: str
    sensor_type: SensorType
    zone_id: str
    warning_low: Optional[float] = None
    warning_high: Optional[float] = None
    critical_low: Optional[float] = None
    critical_high: Optional[float] = None


@dataclass
class RuleViolation:
    rule: Rule
    reading: SensorReading
    severity: AlertSeverity
    message: str


DEFAULT_RULES = [
    Rule("Humidity", SensorType.HUMIDITY, "zone_air",
         warning_low=40.0, warning_high=85.0, critical_low=30.0, critical_high=95.0),
    Rule("Soil Temperature A", SensorType.SOIL_TEMPERATURE, "zone_bed_a",
         warning_low=15.0, warning_high=30.0, critical_low=10.0, critical_high=35.0),
    Rule("Soil pH A", SensorType.SOIL_PH, "zone_bed_a",
         warning_low=5.5, warning_high=7.0, critical_low=5.0, critical_high=7.5),
    Rule("Soil Moisture A", SensorType.SOIL_MOISTURE, "zone_bed_a",
         warning_low=25.0, warning_high=75.0, critical_low=15.0, critical_high=85.0),
    Rule("Soil Temperature B", SensorType.SOIL_TEMPERATURE, "zone_bed_b",
         warning_low=15.0, warning_high=30.0, critical_low=10.0, critical_high=35.0),
    Rule("Soil pH B", SensorType.SOIL_PH, "zone_bed_b",
         warning_low=5.5, warning_high=7.0, critical_low=5.0, critical_high=7.5),
    Rule("Soil Moisture B", SensorType.SOIL_MOISTURE, "zone_bed_b",
         warning_low=25.0, warning_high=75.0, critical_low=15.0, critical_high=85.0),
    Rule("Soil Temperature C", SensorType.SOIL_TEMPERATURE, "zone_bed_c",
         warning_low=15.0, warning_high=30.0, critical_low=10.0, critical_high=35.0),
    Rule("Soil pH C", SensorType.SOIL_PH, "zone_bed_c",
         warning_low=5.5, warning_high=7.0, critical_low=5.0, critical_high=7.5),
    Rule("Soil Moisture C", SensorType.SOIL_MOISTURE, "zone_bed_c",
         warning_low=25.0, warning_high=75.0, critical_low=15.0, critical_high=85.0),
]


class RulesEngine:
    def __init__(self, rules: Optional[List[Rule]] = None):
        self.rules = rules or DEFAULT_RULES
        self._cooldowns: dict = {}

    def evaluate(self, readings: List[SensorReading]) -> List[RuleViolation]:
        violations = []
        for reading in readings:
            for rule in self.rules:
                if reading.sensor_type != rule.sensor_type:
                    continue
                if reading.zone_id != rule.zone_id:
                    continue

                violation = self._check_rule(rule, reading)
                if violation and self._should_fire(rule.name):
                    violations.append(violation)

        return violations

    def _check_rule(self, rule: Rule, reading: SensorReading) -> Optional[RuleViolation]:
        val = reading.value

        if rule.critical_low is not None and val < rule.critical_low:
            return RuleViolation(
                rule=rule, reading=reading, severity=AlertSeverity.CRITICAL,
                message=f"{rule.name} critically low: {val:.1f} (threshold: {rule.critical_low})",
            )
        if rule.critical_high is not None and val > rule.critical_high:
            return RuleViolation(
                rule=rule, reading=reading, severity=AlertSeverity.CRITICAL,
                message=f"{rule.name} critically high: {val:.1f} (threshold: {rule.critical_high})",
            )
        if rule.warning_low is not None and val < rule.warning_low:
            return RuleViolation(
                rule=rule, reading=reading, severity=AlertSeverity.WARNING,
                message=f"{rule.name} below warning: {val:.1f} (threshold: {rule.warning_low})",
            )
        if rule.warning_high is not None and val > rule.warning_high:
            return RuleViolation(
                rule=rule, reading=reading, severity=AlertSeverity.WARNING,
                message=f"{rule.name} above warning: {val:.1f} (threshold: {rule.warning_high})",
            )
        return None

    def _should_fire(self, rule_name: str) -> bool:
        """Simple cooldown: suppress duplicate alerts within 60 seconds."""
        import time
        now = time.time()
        last = self._cooldowns.get(rule_name, 0)
        if now - last < 60:
            return False
        self._cooldowns[rule_name] = now
        return True


rules_engine = RulesEngine()
