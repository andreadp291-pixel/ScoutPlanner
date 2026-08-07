export type Block =
  | { id: string; type: 'title'; text: string }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'list'; items: string[] }
  | { id: string; type: 'image'; url: string; filename: string }
  | { id: string; type: 'link'; url: string; label: string }
  | { id: string; type: 'phone'; number: string }
  | { id: string; type: 'location'; name: string; lat: number; lon: number }
  | { id: string; type: 'table'; rows: string[][] }
  | { id: string; type: 'divider' }

export type BlockType = Block['type']

export interface ActivityDoc {
  blocks: Block[]
}

export function newBlockId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function emptyBlock(type: BlockType): Block {
  const id = newBlockId()
  switch (type) {
    case 'title':
      return { id, type, text: '' }
    case 'text':
      return { id, type, text: '' }
    case 'list':
      return { id, type, items: [''] }
    case 'image':
      return { id, type, url: '', filename: '' }
    case 'link':
      return { id, type, url: '', label: '' }
    case 'phone':
      return { id, type, number: '' }
    case 'location':
      return { id, type, name: '', lat: 0, lon: 0 }
    case 'table':
      return {
        id,
        type,
        rows: [
          ['', ''],
          ['', ''],
        ],
      }
    case 'divider':
      return { id, type }
  }
}

export function parseActivityDoc(raw: string | undefined): ActivityDoc {
  if (!raw) return { blocks: [] }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as ActivityDoc).blocks)
    ) {
      return parsed as ActivityDoc
    }
  } catch {
    // formato non riconosciuto (es. vecchia descrizione stile blog): si riparte da vuoto
  }
  return { blocks: [] }
}

export function isDocEmpty(doc: ActivityDoc): boolean {
  return doc.blocks.length === 0
}
