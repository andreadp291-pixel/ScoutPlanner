export function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5 7h14M9.5 7V4.8a1 1 0 011-1h3a1 1 0 011 1V7M18 7l-.8 12.1a1.5 1.5 0 01-1.5 1.4H8.3a1.5 1.5 0 01-1.5-1.4L6 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.2 11v6M13.8 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
