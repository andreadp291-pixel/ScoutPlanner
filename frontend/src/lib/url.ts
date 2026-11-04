export function isSafeUrl(url: string): boolean {
  return /^(https?:|mailto:|tel:|\/|#)/i.test(url.trim())
}

// Per gli URL dei file caricati: solo http(s), mai "javascript:" o simili.
export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}
