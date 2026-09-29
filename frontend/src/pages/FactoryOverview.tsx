import KPICards from "../features/dashboard/components/KPICards";
import DigitalTwinPanel from "../features/dashboard/components/DigitalTwinPanel";
import AIEvents from "../features/dashboard/components/AIEvents";
import SustainabilityPanel from "../features/dashboard/components/SustainabilityPanel";
import MaintenancePanel from "../features/dashboard/components/MaintenancePanel";

export default function FactoryOverview() {
  return (
    <main className="min-h-full w-full bg-[#F7FAF8] text-[#15211B]">
      <div className="mx-auto w-full max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">

        {/* =====================================================
            HERO
        ===================================================== */}

        <section className="overflow-hidden rounded-[16px] border border-[#DDE7E1] bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">

          <div className="relative flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-7 lg:py-7">

            {/* Subtle Figma-style decoration */}

            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-50 blur-3xl" />

            <div className="relative min-w-0">

              <div className="flex items-center gap-2">

                <span className="relative flex h-2 w-2">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-[#16A34A]/30" />
                  <span className="relative h-2 w-2 rounded-full bg-[#16A34A]" />
                </span>

                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
                  Live Factory Intelligence
                </span>

              </div>

              <h1 className="mt-2.5 text-[30px] font-extrab800 tracking-[-0.025em] text-[#15211B] sm:text-[34px] lg:text-[38px]">
                Factory Overview
              </h1>

              <p className="mt-2 max-w-[650px] text-[13px] leading-5 text-[#64736A] sm:text-sm">
                Real-time digital twin, predictive maintenance and
                sustainability intelligence for your factory.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">

                <StatusPill
                  dot="bg-[#16A34A]"
                  text="Digital Twin Active"
                />

                <StatusPill
                  dot="bg-[#0891B2]"
                  text="Telemetry Connected"
                />

                <StatusPill
                  dot="bg-[#7C3AED]"
                  text="AI Monitoring"
                />

              </div>

            </div>

            {/* System status */}

            <div className="relative w-full shrink-0 overflow-hidden rounded-[14px] bg-gradient-to-br from-[#087443] to-[#0B8A4C] p-4.5 text-white shadow-[0_6px_20px_rgba(5,150,105,0.10)] lg:w-[250px]">

              <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />

              <div className="relative">

                <div className="flex items-center justify-between">

                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-50/80">
                    System Status
                  </p>

                  <span className="rounded-[5px] bg-white/15 px-1.5 py-0.5 text-[8px] font-bold tracking-wider">
                    LIVE
                  </span>

                </div>

                <div className="mt-3.5 flex items-center gap-2.5">

                  <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/10">

                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute h-full w-full animate-ping rounded-full bg-white/30" />
                      <span className="relative h-2.5 w-2.5 rounded-full bg-emerald-200" />
                    </span>

                  </div>

                  <div>
                    <p className="text-[13px] font-bold">
                      AI Systems Online
                    </p>

                    <p className="mt-0.5 text-[9px] text-emerald-50/70">
                      Live telemetry connected
                    </p>
                  </div>

                </div>

                <div className="my-3.5 h-px bg-white/15" />

                <div className="flex items-center justify-between">

                  <span className="text-[9px] text-emerald-50/70">
                    Platform Status
                  </span>

                  <span className="flex items-center gap-1.5 text-[9px] font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-200" />
                    Operational
                  </span>

                </div>

              </div>

            </div>

          </div>

        </section>

        {/* =====================================================
            FACTORY METRICS
        ===================================================== */}

        <section className="mt-7">

          <SectionHeading
            title="Factory Metrics"
            description="Current operational and environmental indicators"
          />

          <div className="mt-3.5">
            <KPICards />
          </div>

        </section>

        {/* =====================================================
            DIGITAL TWIN
        ===================================================== */}

        <section className="mt-8">

          <SectionHeading
            title="Digital Twin"
            description="Live representation of factory assets"
            badge="LIVE DATA"
          />

          <div className="mt-3.5">
            <DigitalTwinPanel />
          </div>

        </section>

        {/* =====================================================
            FACTORY INTELLIGENCE
        ===================================================== */}

        <section className="mt-8">

          <SectionHeading
            title="Factory Intelligence"
            description="AI-driven risk detection and sustainability insights"
          />

          <div className="mt-3.5">
            <SustainabilityPanel />
          </div>

          <div className="mt-4">
            <AIEvents />
          </div>

        </section>

        {/* =====================================================
            ASSET RELIABILITY
        ===================================================== */}

        <section className="mt-8">

          <SectionHeading
            title="Asset Reliability"
            description="Predictive maintenance status and intervention priorities"
          />

          <div className="mt-3.5">
            <MaintenancePanel />
          </div>

        </section>

        {/* =====================================================
            FOOTER
        ===================================================== */}

        <footer className="mt-10 border-t border-[#DCE8E1] py-5">

          <div className="flex flex-col gap-1.5 text-[10px] text-[#94A39A] sm:flex-row sm:items-center sm:justify-between">

            <span>
              CarbonTwin OS · Enterprise Digital Twin Platform
            </span>

            <span>
              Predictive AI · Digital Twin · Sustainability
            </span>

          </div>

        </footer>

      </div>
    </main>
  );
}


/* ================================================================
   STATUS PILL
================================================================ */

interface StatusPillProps {
  dot: string;
  text: string;
}

function StatusPill({
  dot,
  text,
}: StatusPillProps) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8E4] bg-white px-2.5 py-1 text-[9px] font-medium text-[#64736A]">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {text}
    </span>
  );
}


/* ================================================================
   SECTION HEADING
================================================================ */

interface SectionHeadingProps {
  title: string;
  description: string;
  badge?: string;
}

function SectionHeading({
  title,
  description,
  badge,
}: SectionHeadingProps) {
  return (
    <div className="flex items-end justify-between gap-4">

      <div className="min-w-0">

        <div className="flex items-center gap-2">

          <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />

          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#16A34A]">
            {title}
          </p>

        </div>

        <p className="mt-1 text-[11px] text-[#64736A] sm:text-xs">
          {description}
        </p>

      </div>

      {badge && (
        <span className="hidden shrink-0 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-1 text-[8px] font-bold uppercase tracking-wider text-[#047857] sm:block">
          {badge}
        </span>
      )}

    </div>
  );
}