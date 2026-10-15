export function AppLogo({
  showName = true,
  compact = false,
  inverse = false,
  subtitle = false,
}: {
  showName?: boolean;
  compact?: boolean;
  inverse?: boolean;
  subtitle?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-3">
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm shadow-indigo-900/15 ${
          compact ? "h-9 w-9" : "h-11 w-11"
        }`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 32 32"
          fill="none"
          className={compact ? "h-5 w-5" : "h-6 w-6"}
        >
          <rect
            x="4.5"
            y="6.5"
            width="23"
            height="21"
            rx="4"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M4.5 12.5h23M10 4.5v4M22 4.5v4M10.5 20l3.4 3.4L22 15.5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showName ? (
        <span>
          <span
            className={`block text-lg font-bold tracking-[-0.02em] ${
              inverse ? "text-white" : "text-slate-950"
            }`}
          >
            Schedule App
          </span>
          {subtitle ? (
            <span
              className={`mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.18em] ${
                inverse ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Event staffing
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
