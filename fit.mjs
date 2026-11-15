export const fields = ['chest', 'waist', 'hip', 'shoulder', 'length', 'inseam'];

// Chart ranges describe bodies; garment values describe the finished clothing.
export function scoreSizes(profile, chart, { category = 'tops', basis = 'garment', preference = 'regular' } = {}) {
  const required = category === 'bottoms' ? ['waist', 'hip'] : ['chest', 'shoulder'];
  const ease = { chest: [4, 10], waist: category === 'bottoms' ? [0, 3] : [2, 10], hip: [2, 8], shoulder: [0, 3], length: [-2, 2], inseam: [-2, 2] };
  const shift = preference === 'relaxed' ? 4 : preference === 'close' ? -2 : 0;
  return chart.map(row => {
    const details = [];
    for (const field of fields) {
      const body = Number(profile[field]);
      if (!(body > 0) || row[field] == null || row[field] === '') continue;
      const raw = String(row[field]).match(/\d+(?:\.\d+)?/g)?.map(Number);
      if (!raw?.length || raw[0] <= 0) continue;
      let lo, hi;
      if (basis === 'body') { lo = raw[0]; hi = raw[1] ?? raw[0]; }
      else {
        let [a, b] = ease[field];
        if (['chest', 'waist', 'hip'].includes(field) && !(category === 'bottoms' && field === 'waist')) { a += shift; b += shift; }
        lo = raw[0] - b; hi = raw[0] - a;
      }
      const distance = body < lo ? lo - body : body > hi ? body - hi : 0;
      const penalty = distance * (body > hi ? 11 : 6);
      details.push({ field, body, chart: String(row[field]), score: Math.max(0, Math.round(100 - penalty)), note: distance === 0 ? 'Within target range' : body > hi ? (['length','inseam'].includes(field) ? 'May be too short' : 'May feel tight') : (['length','inseam'].includes(field) ? 'May be too long' : 'May feel loose') });
    }
    if (!details.length) return { size: row.size, score: null, label: 'Not enough data', details, confidence: 'Low' };
    const primary = details.filter(d => required.includes(d.field));
    const average = details.reduce((sum, d) => sum + d.score, 0) / details.length;
    const weakest = Math.min(...(primary.length ? primary : details).map(d => d.score));
    const score = Math.round(Math.min(average, weakest + 12));
    const complete = required.every(f => details.some(d => d.field === f));
    return { size: row.size, score, label: score >= 90 ? 'Excellent fit' : score >= 75 ? 'Good fit' : score >= 55 ? 'Fair fit' : score >= 30 ? 'Poor fit' : 'Not a good fit', details, confidence: complete && details.length >= 3 ? 'Moderate' : 'Low' };
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}
