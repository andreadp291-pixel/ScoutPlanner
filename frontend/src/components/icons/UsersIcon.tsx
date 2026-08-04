export function UsersIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.5 5.3c1.4.4 2.4 1.7 2.4 3.2 0 1.5-1 2.8-2.4 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15.8 13.6c2.3.4 4.2 2.4 4.2 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
