import type { ReactNode } from "react";

export default function PageHeader({
  index,
  title,
  lede,
  aside,
}: {
  index: string;
  title: string;
  lede: string;
  aside?: ReactNode;
}) {
  return (
    <header className="sheet-head gap-4 md:flex-row md:items-end md:justify-between">
      <div className="sheet-head-main">
        <p className="sheet-index">{index}</p>
        <h1 className="t-display text-ink">{title}</h1>
        <p className="lede">{lede}</p>
      </div>

      {aside ? (
        <div className="sheet-aside shrink-0 md:items-end md:text-right">
          {aside}
        </div>
      ) : null}
    </header>
  );
}
