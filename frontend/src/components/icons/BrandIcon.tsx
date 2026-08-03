export function BrandIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M12 3L21 19H15L12 13L9 19H3L12 3Z" fill="currentColor" />
      <path d="M12 3L16.5 19H13.2L12 13.5L10.8 19H7.5L12 3Z" fill="var(--bg)" fillOpacity="0.35" />
      <path d="M2 20H22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
