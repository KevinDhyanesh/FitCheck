const decode = s => s.replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
const clean = s => decode(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const header = s => {
  s = s.toLowerCase().replace(/_/g, ' ');
  if (/sleeve/.test(s)) return null;
  if (/size|label/.test(s)) return 'size';
  if (/inseam|inside leg/.test(s)) return 'inseam';
  if (/shoulder/.test(s)) return 'shoulder';
  if (/chest|bust/.test(s)) return 'chest';
  if (/waist/.test(s)) return 'waist';
  if (/hip|seat/.test(s)) return 'hip';
  if (/length/.test(s)) return 'length';
  return null;
};
export function parseChart(text, unit = 'cm') {
  let rows;
  if (/<tr[\s>]/i.test(text)) rows = [...text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r => [...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => clean(c[1])));
  else rows = text.trim().split(/\r?\n/).filter(Boolean).map(r => r.trim().split(/\t|\s*\|\s*|\s*,\s*|\s*;\s*|\s{2,}/).map(clean));
  // Some brand charts put sizes across the top and measurement names down the side.
  const sizeRow = rows.findIndex(r => /^(sizes?|measurements?)$/i.test(r[0] || '') && r.slice(1).filter(c => /^(?:[2-5]?X{0,3}[SML]|\d{1,3})$/i.test(c)).length >= 2);
  if (sizeRow >= 0 && rows.slice(sizeRow + 1).some(r => header(r[0]) && header(r[0]) !== 'size')) {
    const source = rows.slice(sizeRow);
    if (!source[0].some(c => header(c) && header(c) !== 'size')) { source[0][0] = 'Size'; rows = source[0].map((_, col) => source.map(r => r[col] || '')); }
  }
  const i = rows.findIndex(r => r.some(c => header(c) === 'size') && r.some(c => header(c) && header(c) !== 'size'));
  if (i < 0) return [];
  const keys = rows[i].map(header);
  return rows.slice(i + 1).map(cells => {
    const row = {};
    cells.forEach((v,j) => {
      if (!keys[j]) return;
      if (keys[j] === 'size') row.size = v;
      else {
        const nums = v.match(/\d+(?:\.\d+)?/g);
        if (nums?.length && nums.length <= 2) row[keys[j]] = nums.map(n => +(Number(n) * (unit === 'in' ? 2.54 : 1)).toFixed(1)).join('-');
      }
    });
    return row;
  }).filter(r => r.size && Object.keys(r).length > 1).slice(0, 30);
}
export function extractProduct(html, url) {
  const meta = (key) => {
    for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
      const attrs = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), decode(m[2])]));
      if (attrs.property === key || attrs.name === key) return attrs.content || '';
    }
    return '';
  };
  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) || [];
  const charts = tables.map(table => {
    const text = clean(table);
    // Ambiguous or dual-unit charts must be reviewed manually.
    const inches = /\binches\b|\b(in)\b/i.test(text), cm = /\bcm\b|centimet/i.test(text);
    return inches && cm ? [] : parseChart(table, inches ? 'in' : 'cm');
  });
  return { title: meta('og:title') || clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '') || new URL(url).hostname, brand: meta('og:site_name') || new URL(url).hostname, description: meta('og:description') || meta('description'), chart: charts.sort((a,b) => b.length-a.length)[0] || [], url, source: 'Product page', needsReview: true };
}
