import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import { EditorContent, type JSONContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef } from 'react'
import { uploadFile } from '../../api/uploads'
import { GpxAttachment } from './GpxAttachmentExtension'

interface RichTextEditorProps {
  projectId: number
  content: JSONContent | null
  editable: boolean
  onChange?: (content: JSONContent) => void
}

const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] }

export function RichTextEditor({ projectId, content, editable, onChange }: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const gpxInputRef = useRef<HTMLInputElement>(null)

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
      GpxAttachment,
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
      editor.chain().focus().setImage({ src: result.url, alt: result.filename }).run()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore durante il caricamento dell'immagine")
    }
  }

  async function handleGpxFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editor) return
    try {
      const result = await uploadFile(projectId, file)
      editor.chain().focus().insertGpxAttachment({ url: result.url, filename: result.filename }).run()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Errore durante il caricamento del file GPX')
    }
  }

  function isSafeUrl(url: string): boolean {
    return /^(https?:|mailto:|tel:|\/|#)/i.test(url.trim())
  }

  function handleImageUrl() {
    const url = window.prompt('URL immagine')
    if (!url) return
    if (!isSafeUrl(url)) {
      alert('URL non valido')
      return
    }
    editor.chain().focus().setImage({ src: url }).run()
  }

  function handleLink() {
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
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  function handlePhone() {
    const phone = window.prompt('Numero di telefono')
    if (!phone) return
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'text',
          text: `📞 ${phone}`,
          marks: [{ type: 'link', attrs: { href: `tel:${phone.replace(/\s+/g, '')}` } }],
        },
        { type: 'text', text: ' ' },
      ])
      .run()
  }

  function handleLocation() {
    const place = window.prompt('Nome del luogo o indirizzo')
    if (!place) return
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: 'text',
          text: `📍 ${place}`,
          marks: [{ type: 'link', attrs: { href: mapsUrl, target: '_blank', rel: 'noopener noreferrer' } }],
        },
        { type: 'text', text: ' ' },
      ])
      .run()
  }

  function handleTable() {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
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
            ❝ Citazione
          </button>
          <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linea divisoria">
            ―
          </button>
          <span className="rich-editor-sep" />
          <button type="button" onClick={handleLink} className={editor.isActive('link') ? 'active' : ''} title="Inserisci link">
            🔗 Link
          </button>
          <button type="button" onClick={() => imageInputRef.current?.click()} title="Carica immagine">
            🖼 Immagine
          </button>
          <button type="button" onClick={handleImageUrl} title="Immagine da URL">
            🖼 Da URL
          </button>
          <button type="button" onClick={handleTable} title="Inserisci tabella">
            ▦ Tabella
          </button>
          <button type="button" onClick={handlePhone} title="Numero di telefono">
            📞 Telefono
          </button>
          <button type="button" onClick={handleLocation} title="Posizione">
            📍 Posizione
          </button>
          <button type="button" onClick={() => gpxInputRef.current?.click()} title="Carica traccia GPX">
            🧭 GPX
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFile} style={{ display: 'none' }} />
          <input ref={gpxInputRef} type="file" accept=".gpx" onChange={handleGpxFile} style={{ display: 'none' }} />
        </div>
      )}
      <EditorContent editor={editor} className="rich-editor-content" />
    </div>
  )
}
