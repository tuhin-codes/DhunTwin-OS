from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RULEstimate:
    """
    Explainable Remaining Useful Life estimate.

    RUL is expressed in hours.

    This is an estimator built from existing CarbonTwin
    condition and predictive signals. It is NOT presented
    as a separately trained RUL machine-learning model.
    """

    remaining_useful_life_hours: float

    condition_factor: float
    predictive_factor: float
    degradation_factor: float
    anomaly_factor: float

    confidence: float

    status: str
    reason: str


class RULEngine:
    """
    Explainable Remaining Useful Life estimator.

    Evidence-aware design:

    - Predictive failure probabilities are always considered
      when available.
    - Learned-baseline deviation is only considered when a
      baseline actually exists.
    - Anomaly persistence is only considered when anomaly
      evidence actually exists.
    - Missing evidence is treated as uncertainty rather than
      being interpreted as either healthy or dangerous.

    This prevents a machine with no learned baseline from
    incorrectly receiving a maximum degradation/anomaly score.
    """

    MIN_RUL_HOURS = 1.0
    MAX_RUL_HOURS = 2000.0

    # ----------------------------------------------------------
    # Clamp
    # ----------------------------------------------------------

    @staticmethod
    def _clamp(
        value: float,
        minimum: float,
        maximum: float,
    ) -> float:

        return max(
            minimum,
            min(
                maximum,
                value,
            ),
        )

    # ----------------------------------------------------------
    # Estimate
    # ----------------------------------------------------------

    @classmethod
    def estimate(
        cls,
        baseline_rul_hours: float,
        health_score: float,
        failure_probability_30m: float,
        failure_probability_60m: float,
        failure_probability_120m: float,
        current_deviation: float | None = None,
        deviation_trend: float | None = None,
        anomaly_persistence: int | None = None,
        baseline_available: bool = True,
        anomaly_available: bool = True,
    ) -> RULEstimate:

        # ======================================================
        # 1. SANITIZE INPUTS
        # ======================================================

        baseline_rul = cls._clamp(
            float(baseline_rul_hours),
            cls.MIN_RUL_HOURS,
            cls.MAX_RUL_HOURS,
        )

        health = cls._clamp(
            float(health_score),
            0.0,
            100.0,
        )

        p30 = cls._clamp(
            float(failure_probability_30m),
            0.0,
            1.0,
        )

        p60 = cls._clamp(
            float(failure_probability_60m),
            0.0,
            1.0,
        )

        p120 = cls._clamp(
            float(failure_probability_120m),
            0.0,
            1.0,
        )

        # ======================================================
        # 2. CONDITION FACTOR
        #
        # Health is available directly from the Digital Twin.
        # ======================================================

        condition_factor = cls._clamp(
            health / 100.0,
            0.05,
            1.0,
        )

        # ======================================================
        # 3. PREDICTIVE FACTOR
        #
        # Near-term risk receives the greatest weight.
        # ======================================================

        predictive_risk = (
            (p30 * 0.50)
            + (p60 * 0.30)
            + (p120 * 0.20)
        )

        predictive_factor = cls._clamp(
            1.0 - predictive_risk,
            0.05,
            1.0,
        )

        # ======================================================
        # 4. DEGRADATION FACTOR
        #
        # IMPORTANT:
        #
        # None means evidence unavailable.
        # Zero means measured deviation is actually zero.
        #
        # These must NOT be treated as the same thing.
        # ======================================================

        degradation_evidence_available = (
            baseline_available
            and current_deviation is not None
        )

        if degradation_evidence_available:

            deviation = max(
                0.0,
                float(current_deviation),
            )

            trend = (
                float(deviation_trend)
                if deviation_trend is not None
                else 0.0
            )

            deviation_penalty = cls._clamp(
                deviation / 5.0,
                0.0,
                0.60,
            )

            trend_penalty = cls._clamp(
                max(
                    0.0,
                    trend,
                ) * 10.0,
                0.0,
                0.30,
            )

            degradation_factor = cls._clamp(
                1.0
                - deviation_penalty
                - trend_penalty,
                0.10,
                1.0,
            )

        else:

            # No baseline = no degradation claim.
            degradation_factor = 1.0

        # ======================================================
        # 5. ANOMALY FACTOR
        #
        # None/unavailable means there is no reliable anomaly
        # evidence yet.
        # ======================================================

        anomaly_evidence_available = (
            anomaly_available
            and anomaly_persistence is not None
        )

        if anomaly_evidence_available:

            persistence = max(
                0,
                int(anomaly_persistence),
            )

            persistence_penalty = cls._clamp(
                persistence * 0.04,
                0.0,
                0.30,
            )

            anomaly_factor = cls._clamp(
                1.0 - persistence_penalty,
                0.70,
                1.0,
            )

        else:

            # No anomaly evidence = neutral factor.
            anomaly_factor = 1.0

        # ======================================================
        # 6. COMBINED FACTOR
        # ======================================================

        combined_factor = (
            condition_factor
            * predictive_factor
            * degradation_factor
            * anomaly_factor
        )

        # ======================================================
        # 7. CALCULATE RUL
        # ======================================================

        rul_hours = (
            baseline_rul
            * combined_factor
        )

        # ======================================================
        # 8. PREDICTIVE SAFETY CAPS
        #
        # These are intentionally driven by model probability,
        # not machine-specific rules.
        # ======================================================

        highest_risk = max(
            p30,
            p60,
            p120,
        )

        if highest_risk >= 0.90:

            rul_hours = min(
                rul_hours,
                24.0,
            )

        elif highest_risk >= 0.75:

            rul_hours = min(
                rul_hours,
                72.0,
            )

        elif highest_risk >= 0.50:

            rul_hours = min(
                rul_hours,
                168.0,
            )

        rul_hours = cls._clamp(
            rul_hours,
            cls.MIN_RUL_HOURS,
            cls.MAX_RUL_HOURS,
        )

        rul_hours = round(
            rul_hours,
            1,
        )

        # ======================================================
        # 9. CONFIDENCE
        #
        # Confidence represents confidence in the RUL estimate,
        # NOT failure probability.
        #
        # Missing baseline/anomaly evidence reduces confidence.
        # ======================================================

        confidence = 0.0

        # Baseline RUL exists.
        if baseline_rul_hours > 0:
            confidence += 0.20

        # Digital Twin health exists.
        if health_score >= 0:
            confidence += 0.20

        # Three predictive horizons exist.
        if (
            failure_probability_30m is not None
            and failure_probability_60m is not None
            and failure_probability_120m is not None
        ):
            confidence += 0.30

        # Learned degradation evidence.
        if degradation_evidence_available:
            confidence += 0.15

        # Anomaly evidence.
        if anomaly_evidence_available:
            confidence += 0.15

        confidence = round(
            cls._clamp(
                confidence,
                0.0,
                1.0,
            ),
            2,
        )

        # ======================================================
        # 10. STATUS
        # ======================================================

        if rul_hours <= 24:

            status = "CRITICAL"

        elif rul_hours <= 72:

            status = "URGENT"

        elif rul_hours <= 168:

            status = "ATTENTION"

        elif rul_hours <= 500:

            status = "DEGRADED"

        else:

            status = "HEALTHY"

        # ======================================================
        # 11. EXPLAINABLE REASON
        # ======================================================

        reasons = []

        if health < 70:

            reasons.append(
                "low machine health"
            )

        elif health < 85:

            reasons.append(
                "reduced machine health"
            )

        if highest_risk >= 0.90:

            reasons.append(
                "very high predictive failure risk"
            )

        elif highest_risk >= 0.50:

            reasons.append(
                "elevated predictive failure risk"
            )

        # ------------------------------------------------------
        # Degradation explanation
        # ------------------------------------------------------

        if degradation_evidence_available:

            deviation = max(
                0.0,
                float(
                    current_deviation
                ),
            )

            trend = (
                float(
                    deviation_trend
                )
                if deviation_trend is not None
                else 0.0
            )

            if deviation > 1.0:

                reasons.append(
                    "significant deviation from learned baseline"
                )

            if trend > 0.01:

                reasons.append(
                    "increasing degradation trend"
                )

        else:

            reasons.append(
                "learned baseline evidence unavailable"
            )

        # ------------------------------------------------------
        # Anomaly explanation
        # ------------------------------------------------------

        if anomaly_evidence_available:

            persistence = max(
                0,
                int(
                    anomaly_persistence
                ),
            )

            if persistence >= 2:

                reasons.append(
                    "persistent anomaly condition"
                )

        else:

            reasons.append(
                "anomaly history evidence unavailable"
            )

        if not reasons:

            reasons.append(
                "current condition and predictive "
                "signals remain relatively stable"
            )

        reason = (
            "RUL estimate is based on "
            + ", ".join(reasons)
            + "."
        )

        return RULEstimate(
            remaining_useful_life_hours=rul_hours,

            condition_factor=round(
                condition_factor,
                4,
            ),

            predictive_factor=round(
                predictive_factor,
                4,
            ),

            degradation_factor=round(
                degradation_factor,
                4,
            ),

            anomaly_factor=round(
                anomaly_factor,
                4,
            ),

            confidence=confidence,

            status=status,

            reason=reason,
        )

    # ==========================================================
    # DICTIONARY RESPONSE
    # ==========================================================

    @classmethod
    def estimate_dict(
        cls,
        baseline_rul_hours: float,
        health_score: float,
        failure_probability_30m: float,
        failure_probability_60m: float,
        failure_probability_120m: float,
        current_deviation: float | None = None,
        deviation_trend: float | None = None,
        anomaly_persistence: int | None = None,
        baseline_available: bool = True,
        anomaly_available: bool = True,
    ) -> dict:

        estimate = cls.estimate(
            baseline_rul_hours=baseline_rul_hours,
            health_score=health_score,
            failure_probability_30m=(
                failure_probability_30m
            ),
            failure_probability_60m=(
                failure_probability_60m
            ),
            failure_probability_120m=(
                failure_probability_120m
            ),
            current_deviation=(
                current_deviation
            ),
            deviation_trend=(
                deviation_trend
            ),
            anomaly_persistence=(
                anomaly_persistence
            ),
            baseline_available=(
                baseline_available
            ),
            anomaly_available=(
                anomaly_available
            ),
        )

        return {
            "remaining_useful_life_hours": (
                estimate.remaining_useful_life_hours
            ),

            "confidence": (
                estimate.confidence
            ),

            "status": (
                estimate.status
            ),

            "reason": (
                estimate.reason
            ),

            "factors": {
                "condition": (
                    estimate.condition_factor
                ),

                "predictive": (
                    estimate.predictive_factor
                ),

                "degradation": (
                    estimate.degradation_factor
                ),

                "anomaly": (
                    estimate.anomaly_factor
                ),
            },

            "method": (
                "Explainable multi-signal RUL estimator"
            ),
        }