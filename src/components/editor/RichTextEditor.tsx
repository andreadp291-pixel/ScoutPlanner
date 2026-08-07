import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { EditorContent, type JSONContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState } from 'react'
import { uploadFile } from '../../api/uploads'
import { ImageIcon } from '../icons/ImageIcon'
import { LinkIcon } from '../icons/LinkIcon'
import { LocationIcon } from '../icons/LocationIcon'
import { PhoneIcon } from '../icons/PhoneIcon'
import { QuoteIcon } from '../icons/QuoteIcon'
import { LocationPickerModal, type PickedLocation } from './LocationPickerModal'

interface RichTextEditorProps {
  projectId: number
  content: JSONContent | null
  editable: boolean
  onChange?: (content: JSONContent) => void
}

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export function RichTextEditor({ projectId, content, editable, onChange }: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto', 'tel'],
      }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: 'Scrivi qui il programma dell\'attività…' }),
    ],
    content: content ?? EMPTY_DOC,
    editable,
    onUpdate: ({ editor }) => onChange?.(editor.getJSON()),
  })

  useEffect(() => {
    if (editor) editor.setEditable(editable)
  }, [editor, editable])

  if (!editor) return null

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editor) return
    try {
      const result = await uploadFile(projectId, file)
      editor.chain().focus().setImage({ src: result.url, alt: result.filename }).scrollIntoView().run()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore durante il caricamento dell'immagine")
    }
  }

  function isSafeUrl(url: string): boolean {
    return /^(https?:|mailto:|tel:|\/|#)/i.test(url.trim())
  }

  function handleImageUrl() {
    if (!editor) return
    const url = window.prompt('URL immagine')
    if (!url) return
    if (!isSafeUrl(url)) {
      alert('URL non valido')
      return
    }
    editor.chain().focus().setImage({ src: url }).scrollIntoView().run()
  }

  function handleLink() {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL del link', previousUrl ?? 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    if (!isSafeUrl(url)) {
      alert('URL non valido')
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).scrollIntoView().run()
  }

  function handlePhone() {
    if (!editor) return
    const phone = window.prompt('Numero di telefono')
    if (!phone) return
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'text',
          text: phone,
          marks: [{ type: 'link', attrs: { href: `tel:${phone.replace(/\s+/g, '')}` } }],
        },
        { type: 'text', text: ' ' },
      ])
      .scrollIntoView()
      .run()
  }

  function handleLocationConfirm(picked: PickedLocation) {
    setShowLocationPicker(false)
    if (!editor) return
    const mapsUrl = `https://www.openstreetmap.org/?mlat=${picked.lat}&mlon=${picked.lon}#map=16/${picked.lat}/${picked.lon}`
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'text',
          text: picked.name,
          marks: [{ type: 'link', attrs: { href: mapsUrl, target: '_blank', rel: 'noopener noreferrer' } }],
        },
        { type: 'text', text: ' ' },
      ])
      .scrollIntoView()
      .run()
  }

  function handleTable() {
    if (!editor) return
    const rowsStr = window.prompt('Numero di righe (esclusa l\'intestazione)', '3')
    if (!rowsStr) return
    const colsStr = window.prompt('Numero di colonne', '3')
    if (!colsStr) return
    const rows = Math.min(Math.max(parseInt(rowsStr, 10) || 3, 1), 30)
    const cols = Math.min(Math.max(parseInt(colsStr, 10) || 3, 1), 12)
    editor
      .chain()
      .focus()
      .insertTable({ rows: rows + 1, cols, withHeaderRow: true })
      .scrollIntoView()
      .run()
  }

  return (
    <div className="rich-editor">
      {editable && (
        <div className="rich-editor-toolbar">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={editor.isActive('bold') ? 'active' : ''} title="Grassetto">
            <b>B</b>
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={editor.isActive('italic') ? 'active' : ''} title="Corsivo">
            <i>I</i>
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={editor.isActive('strike') ? 'active' : ''} title="Barrato">
            <s>S</s>
          </button>
          <span className="rich-editor-sep" />
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={editor.isActive('heading', { level: 1 }) ? 'active' : ''} title="Titolo 1">
            H1
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'active' : ''} title="Titolo 2">
            H2
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={editor.isActive('heading', { level: 3 }) ? 'active' : ''} title="Titolo 3">
            H3
          </button>
          <span className="rich-editor-sep" />
          <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={editor.isActive('bulletList') ? 'active' : ''} title="Elenco puntato">
            • Elenco
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={editor.isActive('orderedList') ? 'active' : ''} title="Elenco numerato">
            1. Elenco
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={editor.isActive('blockquote') ? 'active' : ''} title="Citazione">
            <QuoteIcon /> Citazione
          </button>
          <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linea divisoria">
            ―
          </button>
          <span className="rich-editor-sep" />
          <button type="button" onClick={handleLink} className={editor.isActive('link') ? 'active' : ''} title="Inserisci link">
            <LinkIcon /> Link
          </button>
          <button type="button" onClick={() => imageInputRef.current?.click()} title="Carica immagine">
            <ImageIcon /> Immagine
          </button>
          <button type="button" onClick={handleImageUrl} title="Immagine da URL">
            <ImageIcon /> Da URL
          </button>
          <button type="button" onClick={handleTable} title="Inserisci tabella">
            ▦ Tabella
          </button>
          <button type="button" onClick={handlePhone} title="Numero di telefono">
            <PhoneIcon /> Telefono
          </button>
          <button type="button" onClick={() => setShowLocationPicker(true)} title="Posizione">
            <LocationIcon /> Posizione
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFile} style={{ display: 'none' }} />
        </div>
      )}
      <EditorContent editor={editor} className="rich-editor-content" />
      {showLocationPicker && (
        <LocationPickerModal
          onConfirm={handleLocationConfirm}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </div>
  )
}
