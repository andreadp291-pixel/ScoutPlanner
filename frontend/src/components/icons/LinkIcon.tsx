export function LinkIcon({ size = 16 }: { size?: number }) {
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
        d="M9.5 14.5l5-5M8 9.5l-1.6 1.6a3.4 3.4 0 0 0 4.8 4.8L13 14M16 14.5l1.6-1.6a3.4 3.4 0 0 0-4.8-4.8L11 9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
