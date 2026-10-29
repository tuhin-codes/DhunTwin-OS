import type { EvidenceTier } from "../types";
import { TIER_LABEL } from "../data/constants";

const CLASSES: Record<EvidenceTier, string> = {
  MEASURED: "tier tier-measured",
  REPORT: "tier tier-report",
  ASSUMPTION: "tier tier-assumption",
  SIMULATED: "tier tier-simulated",
};

const EXPLANATION: Record<EvidenceTier, string> = {
  MEASURED:
    "Observed on site or counted directly.",
  REPORT:
    "Taken from Dhun's own reporting documents.",
  ASSUMPTION:
    "A stated planning assumption. Not verified.",
  SIMULATED:
    "Produced by the twin's deterministic model.",
};

export default function EvidenceBadge({
  tier,
  title,
}: {
  tier: EvidenceTier;
  title?: string;
}) {
  return (
    <span
      className={CLASSES[tier]}
      title={title ?? EXPLANATION[tier]}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}
