// Il campo `materials` resta testo: una riga per voce, «cosa<TAB>chi» (chi = ref persona 'o'/'m3'/'t5' o gruppo 'g7').
// Le righe senza TAB sono il vecchio formato libero: voci separate da virgola / punto e virgola, senza chi.
export interface MaterialRow {
  cosa: string
  chi: string
}

export function parseMaterials(text: string): MaterialRow[] {
  return text.split('\n').flatMap((line) => {
    if (line.includes('\t')) {
      const [cosa, chi = ''] = line.split('\t')
      return [{ cosa, chi: chi.trim() }]
    }
    return line
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((cosa) => ({ cosa, chi: '' }))
  })
}

// Le righe vuote restano (servono mentre si scrive); chi legge le scarta.
export const serializeMaterials = (rows: MaterialRow[]) =>
  rows.map((r) => `${r.cosa.replace(/[\t\n]/g, ' ')}\t${r.chi}`).join('\n')
