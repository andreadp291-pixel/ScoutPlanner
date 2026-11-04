export function RouteIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="5.5" cy="6" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18.5" cy="18" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 8v3a4 4 0 004 4h5a4 4 0 004 4v-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="1 3.2"
      />
    </svg>
  )
}
