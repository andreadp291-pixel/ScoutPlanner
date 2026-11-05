export type Role = 'editor' | 'commenter' | 'viewer'

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietario',
  editor: 'Editor',
  commenter: 'Commentatore',
  viewer: 'Sola lettura',
}

// chi può modificare i contenuti: il commentatore no
export const canEditRole = (role?: string) => role === 'owner' || role === 'editor'
