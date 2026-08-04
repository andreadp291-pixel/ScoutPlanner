import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { GpxAttachmentView } from './GpxAttachmentView'

export interface GpxAttachmentAttrs {
  url: string
  filename: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    gpxAttachment: {
      insertGpxAttachment: (attrs: GpxAttachmentAttrs) => ReturnType
    }
  }
}

export const GpxAttachment = Node.create({
  name: 'gpxAttachment',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: null,
        parseHTML: (el: HTMLElement) => el.querySelector('a')?.getAttribute('href') ?? null,
        renderHTML: () => ({}),
      },
      filename: {
        default: 'traccia.gpx',
        parseHTML: (el: HTMLElement) => el.querySelector('a')?.textContent?.trim() ?? 'traccia.gpx',
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="gpx-attachment"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const { url, filename } = node.attrs as GpxAttachmentAttrs
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'gpx-attachment', class: 'gpx-attachment' }),
      [
        'a',
        {
          href: url,
          download: filename,
          class: 'gpx-attachment-link',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        `🧭  ${filename}`,
      ],
    ]
  },

  addCommands() {
    return {
      insertGpxAttachment:
        (attrs: GpxAttachmentAttrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(GpxAttachmentView)
  },
})
