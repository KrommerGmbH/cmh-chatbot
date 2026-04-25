/**
 * 간단한 마크다운 → HTML 변환기 (외부 라이브러리 없이).
 * bold, italic, inline code, code block, table, list, blockquote, link, hr 지원.
 */
export function simpleMarkdown(src: string): string {
  let html = src
    // code block (```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
      return `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
    })
    // inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    // hr
    .replace(/^---$/gm, '<hr>')

  // table
  html = html.replace(
    /(?:^|\n)\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)+)/g,
    (_m, headerRow: string, bodyRows: string) => {
      const headers = headerRow
        .split('|')
        .map((h: string) => h.trim())
        .filter(Boolean)
      const rows = bodyRows
        .trim()
        .split('\n')
        .map((r: string) =>
          r
            .split('|')
            .map((c: string) => c.trim())
            .filter(Boolean),
        )
      let t = '<table><thead><tr>'
      for (const h of headers) t += `<th>${h}</th>`
      t += '</tr></thead><tbody>'
      for (const row of rows) {
        t += '<tr>'
        for (const c of row) t += `<td>${c}</td>`
        t += '</tr>'
      }
      t += '</tbody></table>'
      return t
    },
  )

  // ordered list
  html = html.replace(/((?:^\d+\..+$\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map((l) => l.replace(/^\d+\.\s*/, ''))
    return '<ol>' + items.map((i) => `<li>${i}</li>`).join('') + '</ol>'
  })

  // unordered list
  html = html.replace(/((?:^[-*]\s+.+$\n?)+)/gm, (block) => {
    const items = block
      .trim()
      .split('\n')
      .map((l) => l.replace(/^[-*]\s+/, ''))
    return '<ul>' + items.map((i) => `<li>${i}</li>`).join('') + '</ul>'
  })

  // blockquote
  html = html.replace(/((?:^>\s?.+$\n?)+)/gm, (block) => {
    const content = block.replace(/^>\s?/gm, '')
    return `<blockquote>${content}</blockquote>`
  })

  // paragraphs (double newline)
  html = html.replace(/\n{2,}/g, '</p><p>')
  if (!html.startsWith('<')) html = '<p>' + html + '</p>'

  return html
}
