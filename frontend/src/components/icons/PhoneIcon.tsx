export function PhoneIcon({ size = 16 }: { size?: number }) {
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
        d="M6.5 4.5h2.7l1.3 3.8-2 1.6a10.5 10.5 0 0 0 5.6 5.6l1.6-2 3.8 1.3v2.7c0 1-.9 1.8-1.9 1.6a15 15 0 0 1-12.4-12.4c-.2-1 .6-1.9 1.6-1.9z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}
