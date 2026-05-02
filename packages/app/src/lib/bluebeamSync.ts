/**
 * T-FIELD-V2-02: Bluebeam Revu markup sync utilities.
 * Parses, merges, and exports Bluebeam markup XML without DOM dependencies.
 */

export interface BluebeamMarkup {
  id: string;
  type: 'highlight' | 'note' | 'measurement' | 'stamp';
  pageId: string;
  coords: { x: number; y: number; width: number; height: number };
  text: string;
  author: string;
  createdAt: number;
}

export interface BluebeamSession {
  sessionId: string;
  documentId: string;
  markups: BluebeamMarkup[];
  participants: string[];
  status: 'open' | 'closed';
}

/**
 * Parses a simple attribute value from an XML tag string.
 * Handles both single and double-quoted attributes.
 */
function parseAttr(tagStr: string, attrName: string): string | null {
  // Match only whole attribute names (preceded by whitespace or start, not part of a longer name)
  const dq = new RegExp(`(?:^|\\s)${attrName}="([^"]*)"`, 'i');
  const sq = new RegExp(`(?:^|\\s)${attrName}='([^']*)'`, 'i');
  const dm = dq.exec(tagStr);
  if (dm) return dm[1];
  const sm = sq.exec(tagStr);
  if (sm) return sm[1];
  return null;
}

function parseMarkupType(raw: string): BluebeamMarkup['type'] {
  const lower = raw.toLowerCase();
  if (lower === 'highlight') return 'highlight';
  if (lower === 'note' || lower === 'sticknote' || lower === 'textnote') return 'note';
  if (lower === 'measurement' || lower === 'measure' || lower === 'dimension') return 'measurement';
  if (lower === 'stamp') return 'stamp';
  return 'note'; // default
}

/**
 * Parses a simple Bluebeam XML markup structure.
 * Expected format: <Markup id="..." type="..." pageId="..." x="..." y="..." width="..." height="..." text="..." author="..." createdAt="..." />
 */
export function parseBluebeamXML(xmlString: string): BluebeamMarkup[] {
  const markups: BluebeamMarkup[] = [];

  // Find all Markup tags (self-closing or with content)
  const tagRegex = /<Markup\s([^>]*?)\/?>(?:<\/Markup>)?/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(xmlString)) !== null) {
    const tagContent = match[1];

    const id = parseAttr(tagContent, 'id');
    if (!id) continue;

    const typeRaw = parseAttr(tagContent, 'type') ?? 'note';
    const pageId = parseAttr(tagContent, 'pageId') ?? '';
    const x = parseFloat(parseAttr(tagContent, 'x') ?? '0');
    const y = parseFloat(parseAttr(tagContent, 'y') ?? '0');
    const width = parseFloat(parseAttr(tagContent, 'width') ?? '0');
    const height = parseFloat(parseAttr(tagContent, 'height') ?? '0');
    const text = parseAttr(tagContent, 'text') ?? '';
    const author = parseAttr(tagContent, 'author') ?? '';
    const createdAt = parseInt(parseAttr(tagContent, 'createdAt') ?? '0', 10);

    markups.push({
      id,
      type: parseMarkupType(typeRaw),
      pageId,
      coords: { x, y, width, height },
      text,
      author,
      createdAt,
    });
  }

  return markups;
}

/**
 * Merges local and remote markup lists using last-writer-wins by createdAt.
 * When a markup exists in both sets with the same id, the one with the higher
 * createdAt timestamp wins.
 */
export function mergeMarkups(
  local: BluebeamMarkup[],
  remote: BluebeamMarkup[],
): BluebeamMarkup[] {
  const map = new Map<string, BluebeamMarkup>();

  for (const m of local) {
    map.set(m.id, m);
  }

  for (const m of remote) {
    const existing = map.get(m.id);
    if (!existing || m.createdAt >= existing.createdAt) {
      map.set(m.id, m);
    }
  }

  return Array.from(map.values());
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function exportToBluebeamXML(markups: BluebeamMarkup[]): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<Markups>');

  for (const m of markups) {
    lines.push(
      `  <Markup id="${escapeXml(m.id)}" type="${m.type}" pageId="${escapeXml(m.pageId)}" ` +
        `x="${m.coords.x}" y="${m.coords.y}" width="${m.coords.width}" height="${m.coords.height}" ` +
        `text="${escapeXml(m.text)}" author="${escapeXml(m.author)}" createdAt="${m.createdAt}" />`,
    );
  }

  lines.push('</Markups>');
  return lines.join('\n');
}

export function filterMarkupsByType(
  markups: BluebeamMarkup[],
  type: BluebeamMarkup['type'],
): BluebeamMarkup[] {
  return markups.filter((m) => m.type === type);
}
