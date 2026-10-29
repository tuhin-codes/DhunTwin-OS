/* ============================================================
   DHUN TWIN OS — MASTERPLAN REFERENCE GALLERY & INSPECTOR
   Displays authentic Dhun masterplan reference sheets:
   - Phase One Development Plan & Land Use (Parcels & SQM)
   - Blue-Green Infrastructure & Watershed Spine
   - Where We Become: The 14 First Principles
   - Residential Typologies (Villas, Town Houses, Dense, Duplex)
   - Mobility & The Dhun Loop Unifying Spine
   ============================================================ */

import { useState } from "react";
import { X, ExternalLink, Sparkles, Layers } from "lucide-react";
import { DHUN_FIRST_PRINCIPLES, DHUN_TYPOLOGIES } from "../gis/dhunGeoData";

interface MasterplanReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

interface ReferenceSheet {
  id: string;
  title: string;
  subtitle: string;
  imagePath: string;
  badge: string;
  description: string;
  keyInsights: string[];
}

const REFERENCE_SHEETS: ReferenceSheet[] = [
  {
    id: "phase-one",
    title: "Phase One Development Plan",
    subtitle: "Zoning Schedule & Initial Construction Parcels",
    imagePath: "/masterplan-references/dhun-phase-one.png",
    badge: "Approved Masterplan Schedule",
    description: "Detailed land-use allocations in the south-central development zone, balancing residential neighborhoods, institutional anchors, eco-tourism, recreation, and circulation.",
    keyInsights: [
      "Residential parcels: 59,288 m², 42,820 m², 29,328 m², 17,970 m², 3,964 m², 3,581 m²",
      "Eco-Tourism & Hospitality Anchor: 99,749 m²",
      "Central Utilities & Facilities: 46,834 m² + 21,188 m²",
      "Institutional Learning Node: 30,458 m²",
      "Recreation & Commons: 25,333 m²",
      "Hierarchy of permeable roads: 24m, 18m, 12m, 9m rights-of-way",
    ],
  },
  {
    id: "blue-green",
    title: "Blue Green Infrastructure",
    subtitle: "Regenerative Watershed & Connected Bioreserve Core",
    imagePath: "/masterplan-references/dhun-blue-green-infrastructure.png",
    badge: "Ecological Framework",
    description: "The hydrological and ecological spine of Dhun, featuring preserved native thickets, cascading rainwater retention lakes, and green fingers radiating into neighborhoods.",
    keyInsights: [
      "Bioreserve: 400-acre contiguous protected habitat (80% site ceiling)",
      "Existing Thickets: Untouched native Khejri, Rohida & Acacia groves",
      "Green Fingers: Linear biophilic corridors linking homes to wild corridors",
      "Cascading water bodies & swales capturing 100% of monsoon runoff",
    ],
  },
  {
    id: "first-principles",
    title: "Where We Become & First Principles",
    subtitle: "Philosophical Blueprint for Regenerative Community Living",
    imagePath: "/masterplan-references/dhun-where-we-become-principles.png",
    badge: "Dhun Charter",
    description: "Dhun is a 500-acre regenerative habitat designed for lifelong learning, holistic wellbeing, and profound harmony with nature in Chak Gulabpura, Rajasthan.",
    keyInsights: [
      "Water Self-Sufficient: 100% on-site rainwater harvesting & reuse",
      "Energy Sufficient: 100% clean solar generation & BESS storage",
      "Built using low-impact, local rammed earth and stone masonry",
      "Contextual use of ancient stepwell & courtyard cooling wisdom",
      "Regenerative agriculture and indigenous Miyawaki afforestation",
    ],
  },
  {
    id: "typology",
    title: "Architectural Typology",
    subtitle: "Passive Thermal Massing & Micro-climate Densification",
    imagePath: "/masterplan-references/dhun-typology.png",
    badge: "Vernacular Architecture",
    description: "Four distinct built typologies engineered to maximize natural daylight, passive cooling, cross-ventilation, and community interaction along the Dhun Loop.",
    keyInsights: [
      "Typology 1: Detached Villas with central courtyards & stepped terraces",
      "Typology 2: Town Houses (2–3 stories) with subterranean cool basement",
      "Typology 3: Dense Urban Structure with wind-scoops and shaded arcades",
      "Typology 4: Duplex Units on Dhun Loop with panoramic bioreserve vistas",
    ],
  },
  {
    id: "mobility",
    title: "Mobility & The Dhun Loop",
    subtitle: "Unifying Public Spine & Zero-Emissions Transit",
    imagePath: "/masterplan-references/dhun-mobility-loop.png",
    badge: "Circulation Strategy",
    description: "The Dhun Loop is the unifying spine that connects and services the entire 500-acre site, prioritizing pedestrians, bicycles, and electric micromobility.",
    keyInsights: [
      "Complete shift from personal cars to shared micromobility & walking",
      "Zero combustion emissions permitted within the site perimeter",
      "6m stabilized permeable corridor with integrated bio-retention swales",
      "The joy of moving: designed as a sensory public promenade",
    ],
  },
];

export default function MasterplanReferenceModal({
  isOpen,
  onClose,
  initialTab = "phase-one",
}: MasterplanReferenceModalProps) {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  const currentSheet = REFERENCE_SHEETS.find((s) => s.id === activeTab) || REFERENCE_SHEETS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-surface rounded-xl border border-rule shadow-2xl flex flex-col overflow-hidden text-ink">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rule bg-surface-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center shadow-xs">
              <Layers size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[17px] font-semibold text-ink leading-none">
                  Dhun Masterplan Reference Archive
                </h3>
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent px-2 py-0.5 rounded">
                  Chak Gulabpura, Rajasthan
                </span>
              </div>
              <p className="text-[12.5px] text-muted mt-0.5">
                Authentic planning documents, zoning schedules, and architectural typologies
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-gray-200/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={19} />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex items-center gap-1 px-6 py-2.5 border-b border-rule bg-surface overflow-x-auto text-[13px]">
          {REFERENCE_SHEETS.map((sheet) => (
            <button
              key={sheet.id}
              type="button"
              onClick={() => setActiveTab(sheet.id)}
              className={`px-3.5 py-1.5 rounded-md font-medium transition-all shrink-0 cursor-pointer ${
                activeTab === sheet.id
                  ? "bg-accent text-white shadow-xs font-semibold"
                  : "text-muted hover:text-ink hover:bg-surface-subtle"
              }`}
            >
              {sheet.title}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#F4F2EA]/40">
          {/* Left Column: Image Viewer */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-surface border border-rule rounded-lg p-3 shadow-xs">
            <div className="relative w-full max-h-[580px] flex items-center justify-center overflow-hidden rounded bg-[#ECE8DC]/50">
              <img
                src={currentSheet.imagePath}
                alt={currentSheet.title}
                className="max-h-[540px] w-auto object-contain rounded shadow-xs"
              />
            </div>
            <div className="mt-3 w-full flex items-center justify-between text-[11px] text-muted px-1">
              <span>Authentic Masterplan Document Reference</span>
              <a
                href={currentSheet.imagePath}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-accent font-semibold hover:underline"
              >
                <span>View Full Resolution</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          {/* Right Column: Architectural & Ecological Breakdown */}
          <div className="lg:col-span-5 flex flex-col gap-4 text-[13px]">
            <div className="bg-surface p-5 rounded-lg border border-rule shadow-xs">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-accent bg-accent/15 px-2 py-0.5 rounded">
                {currentSheet.badge}
              </span>
              <h4 className="text-[19px] font-semibold text-ink mt-2">{currentSheet.title}</h4>
              <p className="text-[12.5px] font-medium text-muted mt-0.5">{currentSheet.subtitle}</p>
              <p className="text-[13px] text-ink-soft leading-relaxed mt-3 border-t border-rule pt-3">
                {currentSheet.description}
              </p>
            </div>

            {/* Key Insights List */}
            <div className="bg-surface p-5 rounded-lg border border-rule shadow-xs flex-1">
              <h5 className="font-mono text-[11px] uppercase tracking-wider text-muted font-bold mb-3 flex items-center gap-1.5">
                <Sparkles size={13} className="text-accent" />
                <span>Documented Masterplan Specifications</span>
              </h5>
              <ul className="space-y-2">
                {currentSheet.keyInsights.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-[12.5px] text-ink-soft">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* If on first-principles, show the 14 principles */}
            {activeTab === "first-principles" && (
              <div className="bg-surface p-4 rounded-lg border border-rule max-h-48 overflow-y-auto">
                <h6 className="font-bold text-[12px] text-ink mb-2">The 14 First Principles:</h6>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {DHUN_FIRST_PRINCIPLES.map((p) => (
                    <div key={p.id} className="p-1.5 rounded bg-surface-subtle border border-rule/60">
                      <strong className="text-accent block leading-tight">{p.name}</strong>
                      <span className="text-[10px] text-muted">{p.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* If on typology, show the 4 built typologies */}
            {activeTab === "typology" && (
              <div className="bg-surface p-4 rounded-lg border border-rule max-h-48 overflow-y-auto">
                <h6 className="font-bold text-[12px] text-ink mb-2">Built Typologies Overview:</h6>
                <div className="space-y-2 text-[11px]">
                  {DHUN_TYPOLOGIES.map((t) => (
                    <div key={t.id} className="p-2 rounded bg-surface-subtle border border-rule/60">
                      <div className="flex items-center justify-between">
                        <strong className="text-ink font-semibold">{t.name}</strong>
                        <span className="font-mono text-accent text-[10px]">{t.floors}</span>
                      </div>
                      <p className="text-muted mt-1">{t.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-rule bg-surface text-[12px] text-muted">
          <span>Source: Dhun Architectural Masterplan Archives · Chak Gulabpura, Rajasthan</span>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-accent px-4 cursor-pointer"
          >
            Close Viewer
          </button>
        </div>
      </div>
    </div>
  );
}
