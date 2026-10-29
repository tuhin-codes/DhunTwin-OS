import { ArrowLeft } from "lucide-react";

import { Link } from "react-router-dom";

import PageHeader from "../features/dhun/components/PageHeader";

export default function NotFound() {
  return (
    <div className="sheet">
      <PageHeader
        index="00 · Missing"
        title="Parcel not found"
        lede="The address you opened is not part of the site model. Nothing was lost — the five instrument panels are ready below."
      />

      <div className="panel max-w-xl">
        <div className="panel-head">
          <h2 className="t-subtitle text-ink">Instrument panels</h2>
        </div>

        <div className="panel-body">
          <ul className="flex flex-col divide-y divide-rule">
            {[
              { path: "/", label: "01 · Campus Masterplan" },
              { path: "/twin", label: "02 · Digital Twin" },
              { path: "/ledger", label: "03 · Carbon Ledger" },
              {
                path: "/scenarios",
                label: "04 · Scenario Cockpit",
              },
              { path: "/compute", label: "05 · Compute Commons" },
            ].map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className="flex items-center justify-between gap-4 py-2 text-[12px] text-ink-soft transition-colors hover:text-ink"
                >
                  <span>{item.label}</span>
                  <span className="tabular font-mono text-[10.5px] text-faint">
                    {item.path}
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-rule pt-4">
            <Link
              to="/"
              className="btn btn-primary"
            >
              <ArrowLeft size={13} />
              Return to Campus Masterplan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
