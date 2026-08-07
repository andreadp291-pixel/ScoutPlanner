export function FileTextIcon({ size = 16 }: { size?: number }) {
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
        d="M14 3H7a1.5 1.5 0 00-1.5 1.5v15A1.5 1.5 0 007 21h10a1.5 1.5 0 001.5-1.5V8.5L14 3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.5 3.2V8a1 1 0 001 1h4.3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 13h7M8.5 16.5h7M8.5 9.5h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
