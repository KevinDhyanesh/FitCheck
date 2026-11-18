import { parseChart } from '/extract.mjs';
import { scoreSizes } from '/fit.mjs';
import { requestApi } from '/api-client.mjs';
const $ = s => document.querySelector(s);
const names = { height: 'Height', chest: 'Chest', waist: 'Waist', hip: 'Hips', shoulder: 'Shoulders', length: 'Desired top length', inseam: 'Desired inseam' };
let unit = 'cm', category = 'tops', chart = [], product = null;
let referenceCategory = null;
let gender = 'women';
let analyzedGender = null;
let analyzedCategory = null;
const escape = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
$('#measurements').innerHTML = Object.entries(names).map(([key,label]) => `<label for="${key}">${label}<div class="input-wrap"><input id="${key}" name="${key}" type="number" min="1" max="300" step="0.1" placeholder="—"><span class="measurement-unit">cm</span></div></label>`).join('');
function readProfile() { return Object.fromEntries(Object.keys(names).map(key => [key, $(`#${key}`).value ? +(+$(`#${key}`).value * (unit === 'in' ? 2.54 : 1)).toFixed(2) : null])); }
function preference() { return $('input[name=preference]:checked').value; }
function invalidate() { $('#results').hidden = true; }
function notice(message, success = false) { $('#status').innerHTML = `<div class="notice ${success ? 'success' : ''}">${escape(message)}</div>`; }
async function api(route, data) {
  // OCR already runs here: keep parsing/scoring independent of the server lifetime.
  if (route === 'parse') return {chart: parseChart(data.text || '', data.unit)};
  if (route === 'check') return {results: scoreSizes(data.profile, data.chart, data)};
  return requestApi(route, data);
}

function store() {
  try { localStorage.setItem('fitcheck-profile', JSON.stringify({ profile: readProfile(), preference: preference() })); $('#save-note').textContent = '✓ Measurements saved on this browser.'; }
  catch { $('#save-note').textContent = 'Storage unavailable. You can still check your fit.'; }
}
try { const saved = JSON.parse(localStorage.getItem('fitcheck-profile')); if (saved?.profile) { for (const key of Object.keys(names)) $(`#${key}`).value = saved.profile[key] || ''; const radio = $(`input[name=preference][value="${['close','regular','relaxed'].includes(saved.preference) ? saved.preference : 'regular'}"]`); radio.checked = true; } } catch {}
$('#profile-form').addEventListener('submit', e => { e.preventDefault(); store(); });
$('#profile-form').addEventListener('input', invalidate);
$('#clear').addEventListener('click', () => { try { localStorage.removeItem('fitcheck-profile'); } catch {} $('#profile-form').reset(); $('#save-note').textContent = 'Your saved measurements have been cleared.'; invalidate(); });
$('#units').addEventListener('click', e => {
  const next = e.target.dataset.unit; if (!next || next === unit) return;
  const profile = readProfile(); unit = next;
  for (const key of Object.keys(names)) { $(`#${key}`).value = profile[key] ? +(profile[key] / (unit === 'in' ? 2.54 : 1)).toFixed(1) : ''; $(`#${key}`).max = unit === 'in' ? '118' : '300'; }
  document.querySelectorAll('.measurement-unit').forEach(el => el.textContent = unit);
  document.querySelectorAll('[data-unit]').forEach(el => { el.classList.toggle('active',el.dataset.unit === unit); el.setAttribute('aria-pressed',el.dataset.unit === unit); });
});
$('#categories').addEventListener('click', e => { if (!e.target.dataset.category) return; category = e.target.dataset.category; if (analyzedCategory && analyzedCategory !== category) { chart = []; analyzedCategory = null; analyzedGender = null; photoExtractedText = null; preview(); notice('Clothing changed. Read the matching chart photo to continue.'); } if (referenceCategory && referenceCategory !== category) { chart = []; referenceCategory = null; product = null; showProduct(); preview(); notice('Category changed. Load the matching reference chart or paste a product chart.'); } document.querySelectorAll('[data-category]').forEach(el => { el.classList.toggle('active',el.dataset.category === category); el.setAttribute('aria-pressed',el.dataset.category === category); }); invalidate(); });
$('#gender-filter').addEventListener('click', e => {
  if (!e.target.dataset.gender || gender === e.target.dataset.gender) return;
  gender = e.target.dataset.gender; $('#reference-range').value = gender;
  document.querySelectorAll('[data-gender]').forEach(button => {
    button.classList.toggle('active', button.dataset.gender === gender);
    button.setAttribute('aria-pressed', button.dataset.gender === gender);
  });
  if (analyzedGender || referenceCategory) { chart = []; analyzedGender = null; analyzedCategory = null; referenceCategory = null; photoExtractedText = null; preview(); }
  invalidate(); notice('Gender changed. Read the matching chart photo to continue.');
});
function preview() {
  const keys = ['size','chest','shoulder','waist','hip','length','inseam'].filter(k => chart.some(r => r[k] != null));
  $('#chart-preview').innerHTML = chart.length ? `<div class="table-scroll"><table><caption class="sr-only">Size chart in centimetres</caption><thead><tr>${keys.map(k => `<th>${escape(k === 'size' ? k : names[k])}${k === 'size' ? '' : ' (cm)'}</th>`).join('')}</tr></thead><tbody>${chart.map(r => `<tr>${keys.map(k => `<td>${escape(r[k] ?? '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
  $('#calculate').hidden = !chart.length; $('#empty').hidden = !!chart.length; invalidate();
}
function showProduct() {
  $('#product-summary').hidden = !product; if (!product) return;
  $('#brand').textContent = product.brand; $('#product-title').textContent = product.title;
  $('#source-link').hidden = !product.url; if (product.url) $('#source-link').href = product.url;
}
$('#import-form').addEventListener('submit', async e => {
  e.preventDefault(); const importJob = photoJob; $('#import').disabled = true; $('#import').textContent = 'Reading…'; notice('Looking for product details and a size table…');
  try {
    const imported = await api('import', {url:$('#url').value});
    if (importJob !== photoJob) return; // A newer uploaded photo owns the workspace.
    if (!imported.chart?.length) { notice('Product found, but its size chart is not available as a readable table. Upload the chart photo below. Your existing chart is kept.'); return; }
    referenceCategory = null; product = imported; chart = imported.chart; analyzedGender = null; analyzedCategory = null; photoExtractedText = null; $('#basis').value = imported.basis || 'garment'; showProduct(); preview(); $('#chart-details').open = false;
    if (chart.length) {
      const keys = ['size','chest','shoulder','waist','hip','length','inseam'].filter(k => chart.some(r => r[k] != null));
      $('#chart-text').value = [keys.join(','), ...chart.map(r => keys.map(k => r[k] ?? '').join(','))].join('\n'); $('#chart-unit').value = 'cm';
      notice('Chart loaded. Ready to compare.', true);
      if (readProfile()[category === 'tops' ? 'chest' : 'waist']) $('#calculate').click();
    } else notice('Product details found, but no readable size table. Upload a photo of the brand size chart below.');
  } catch (err) { if (importJob === photoJob) notice(err.message); $('#chart-details').open = false; }
  finally { $('#import').disabled = false; $('#import').textContent = 'Read link ↗'; }
});
$('#apply-chart').addEventListener('click', async () => {
  try { referenceCategory = null; const parsed = await api('parse', {text:$('#chart-text').value, unit:$('#chart-unit').value}); chart = parsed.chart; preview(); if (!chart.length) throw new Error('No size rows found. Include a Size header and separate the columns with commas or tabs.'); $('#chart-details').open = false; notice('Chart ready. Compare sizes when you are ready.', true); }
  catch (err) { notice(err.message); }
});
$('#chart-text').addEventListener('input', () => { referenceCategory = null; chart = []; preview(); });
$('#chart-unit').addEventListener('change', () => { referenceCategory = null; chart = []; preview(); });
$('#basis').addEventListener('change', invalidate);
$('#reference-range').addEventListener('change', () => { if (referenceCategory) { chart = []; referenceCategory = null; product = null; showProduct(); preview(); notice('Reference selection changed. Click Use reference chart to load it.'); } });
$('#calculate').addEventListener('click', async () => {
  const profile = readProfile();
  if (!$('#profile-form').reportValidity()) return;
  if (!(category === 'tops' ? profile.chest : profile.waist)) { notice(`Add your ${category === 'tops' ? 'chest' : 'waist'} measurement first.`); $(`#${category === 'tops' ? 'chest' : 'waist'}`).focus(); return; }
  $('#calculate').disabled = true;
  try {
    const { results } = await api('check', {profile,chart,category,basis:$('#basis').value,preference:preference()});
    const usable = results.filter(r => r.score !== null); if (!usable.length) throw new Error('The chart and your measurements have no matching fields. Add the relevant measurements first.');
    const best = usable[0], recommended = best.score >= 75;
    $('#results').innerHTML = `<div class="recommend"><div class="score-hero"><p class="eyebrow">YOUR FIT SCORE</p><div class="score-value">${best.score}<span>/100</span></div><p class="score-rating">${escape(best.label)}</p></div><div class="recommend-copy"><p class="eyebrow">${recommended ? 'YOUR CLOSEST MATCH' : 'NO STRONG MATCH'}</p><h3>${recommended ? `Size ${escape(best.size)}` : `Closest: ${escape(best.size)}`} <span style="font-size:13px;font-weight:500">${escape(best.label)}</span></h3><p>${recommended ? 'Best match among the sizes in this chart.' : `Size ${escape(best.size)} scores highest, but may not fit comfortably.`}<br>${referenceCategory ? 'Low confidence — general reference only' : escape(best.confidence) + ' confidence'}</p></div></div><details class="fit-details"><summary>View fit details <span>+</span></summary><div class="breakdown"><h3>Your size breakdown</h3>${results.map(r => `<div class="size-result"><div class="size-line"><span class="size-label">${escape(r.size)}</span><span class="rating">${escape(r.label)}</span><span class="score-text">${r.score === null ? '—' : `${r.score}/100`}</span></div><div class="bar"><span style="width:${r.score ?? 0}%"></span></div><div class="dimension-list">${r.details.map(d => `<span class="${d.score < 90 ? 'warning' : ''}" title="Your measurement: ${d.body} cm; chart: ${escape(d.chart)} cm">${escape(names[d.field])}: ${escape(d.note)}</span>`).join('')}</div></div>`).join('')}</div><p class="disclaimer">This is a rule-based estimate, not a probability or a guarantee. Scores compare chart measurements with your body and general fit allowances. Height alone cannot predict garment length. Stretch, tailoring, oversized cuts and personal preference may change the result. Missing measurements reduce confidence.</p></details>`;
    $('#results').hidden = false; $('#results').focus({preventScroll:true}); $('#results').scrollIntoView({behavior:'auto',block:'start'}); store(); notice(referenceCategory ? 'Estimate ready. Based on general sizing.' : 'Your comparison is ready.',true);
  } catch (err) { notice(err.message); } finally { $('#calculate').disabled = false; }
});
$('#demo').addEventListener('click', () => {
  referenceCategory = null;
  product = {title:'Everyday cotton tee — example',brand:'FITCHECK SAMPLE · NOT A LIVE PRODUCT',url:null}; showProduct();
  $('#chart-text').value = 'Size,Chest,Shoulder,Length\nS,100,43,68\nM,106,45,71\nL,112,47,74\nXL,118,49,77';
  $('#chart-unit').value = 'cm'; $('#basis').value = 'garment'; chart = [{size:'S',chest:100,shoulder:43,length:68},{size:'M',chest:106,shoulder:45,length:71},{size:'L',chest:112,shoulder:47,length:74},{size:'XL',chest:118,shoulder:49,length:77}];
  category = 'tops'; document.querySelector('[data-category=tops]').click(); $('#chart-details').open = false; preview(); notice('Example chart loaded. Add your measurements, then compare sizes. Your measurements have not been changed.',true);
});

// Transcribed inch values from the user-provided general sizing image.
// Convert with 2.54 rather than copying its rounded/inconsistent cm columns.
const referenceSizes = ['XS','S','M','L','XL','XXL','XXXL'];
const referenceInches = {
  women: {
    tops: { chest:[32,34,36,38,40,42,44], waist:[26,28,30,32,34,36,38], hip:[35,37,39,41,43,45,47] },
    bottoms: { waist:[26,28,30,32,34,36], hip:[35,37,39,41,43,45], inseam:[28,30,30,32,32,32] }
  },
  men: {
    tops: { chest:[36,38,40,42,44,46,48], waist:[31,33,35,37,39,41,43], shoulder:[16.5,17,17.5,18,18.5,19,19.5] },
    bottoms: { waist:[30,32,34,36,38], hip:[38,40,42,44,46], inseam:[30,31,32,32,32] }
  }
};
$('#load-reference').addEventListener('click', () => {
  const range = $('#reference-range').value;
  const values = referenceInches[range][category];
  chart = values.waist.map((_, i) => Object.fromEntries([
    ['size', referenceSizes[i + (range === 'men' && category === 'bottoms' ? 1 : 0)]],
    ...Object.entries(values).map(([key, measurements]) => [key, +(measurements[i] * 2.54).toFixed(2)])
  ]));
  referenceCategory = category;
  product = { title: `${range === 'women' ? "Women's" : "Men's"} ${category} — general reference`, brand:'USER-SUPPLIED CHART · NOT PRODUCT-SPECIFIC', url:null };
  const keys = ['size', ...Object.keys(values)];
  $('#chart-text').value = [keys.join(','), ...chart.map(row => keys.map(key => row[key]).join(','))].join('\n');
  $('#chart-unit').value = 'cm'; $('#basis').value = 'body';
  showProduct(); preview(); $('#chart-details').open = false;
  notice('General sizing selected. Product-specific sizing may differ.');
});


let photoPreviewUrl = null;
let photoJob = 0;
let activePhotoWorker = null;
let photoExtractedText = null;
let pendingPhotoChart = null;
function clearChartPhoto(clearInput = true) {
  photoJob++;
  pendingPhotoChart = null; $('#photo-unit-choice').hidden = true;
  if (activePhotoWorker) { activePhotoWorker.terminate().catch(() => {}); activePhotoWorker = null; }
  if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl = null;
  $('#chart-photo-preview').hidden = true;
  $('#chart-photo-preview').removeAttribute('src');
  if (clearInput) $('#chart-photo').value = '';
  $('#chart-photo').disabled = false;
  $('#read-chart-photo').disabled = false;
  $('#read-chart-photo').textContent = 'Read chart';
  $('#remove-chart-photo').hidden = true;
  $('#photo-status').textContent = '';
  if (photoExtractedText !== null && $('#chart-text').value === photoExtractedText) {
    $('#chart-text').value = ''; chart = []; preview(); $('#status').textContent = '';
  }
  photoExtractedText = null;
}
$('#remove-chart-photo').addEventListener('click', () => {
  clearChartPhoto(); $('#photo-status').textContent = 'Photo removed. Choose another whenever you are ready.';
  $('#chart-photo').focus();
});
let ocrLoader = null;
function loadPhotoReader() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!ocrLoader) ocrLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    script.onload = () => resolve(window.Tesseract);
    script.onerror = () => { script.remove(); ocrLoader = null; reject(new Error('Photo reader could not load. Check your connection and retry.')); };
    document.head.append(script);
  });
  return ocrLoader;
}
function selectedChartPhoto() {
  const file = $('#chart-photo').files[0];
  if (!file) throw new Error('Choose a size-chart photo first.');
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPG or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  return file;
}
$('#chart-photo').addEventListener('change', () => {
  clearChartPhoto(false);
  $('#remove-chart-photo').hidden = !$('#chart-photo').files.length;
  try {
    const file = selectedChartPhoto();
    photoPreviewUrl = URL.createObjectURL(file);
    $('#chart-photo-preview').src = photoPreviewUrl;
    $('#chart-photo-preview').hidden = false;
    $('#photo-status').textContent = 'Photo ready. Click Read chart.';
  } catch (err) { $('#photo-status').textContent = err.message; }
});
// Enlarge small text and normalize dark chart backgrounds before recognition.
async function prepareChartPhoto(file, lowerHalf = false, threshold = false) {
  const bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'});
  try {
    if (bitmap.width * bitmap.height > 40000000) throw new Error('This photo is very large. Choose a smaller screenshot of the chart.');
    const startY = lowerHalf ? Math.floor(bitmap.height * 0.48) : 0;
    const sourceHeight = bitmap.height - startY;
    const scale = Math.min(8, 2600 / Math.max(bitmap.width, sourceHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d', {willReadFrequently: true});
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, startY, bitmap.width, sourceHeight, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < pixels.data.length; i += 4) sum += .299 * pixels.data[i] + .587 * pixels.data[i+1] + .114 * pixels.data[i+2];
    const dark = sum / (pixels.data.length / 4) < 127;
    for (let i = 0; i < pixels.data.length; i += 4) {
      let gray = .299 * pixels.data[i] + .587 * pixels.data[i+1] + .114 * pixels.data[i+2];
      if (dark) gray = 255 - gray;
      gray = Math.max(0, Math.min(255, (gray - 128) * 1.65 + 128));
      if (threshold) gray = gray < 160 ? 0 : 255;
      pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = gray;
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  } finally { bitmap.close(); }
}
function detectPhotoChart(text, selectedGender, selectedCategory) {
  const cm = /\bcm\b|centimet(?:er|re)s?/i.test(text);
  const inches = /\binch(?:es)?\b|\(\s*in\s*\)|\bmeasurements?\s+(?:are\s+)?in\s+in\b/i.test(text);

  const women = /\bwomen(?:['’]s)?\b|\bfemale\b/i.test(text);
  const men = /\bmen(?:['’]s)?\b|\bmale\b/i.test(text);
  if (women && men) throw new Error('This photo contains multiple charts. Upload just the chart matching your filters.');
  if ((women && selectedGender === 'men') || (men && selectedGender === 'women')) throw new Error('This chart does not match the selected gender. Change the filter or photo.');
  const tops = /\b(tops?|shirts?|hoodies?|tees?|t-shirts?)\b/i.test(text);
  const bottoms = /\b(bottoms?|pants?|jeans?|trousers?)\b/i.test(text);
  if ((tops && bottoms) || (tops && selectedCategory === 'bottoms') || (bottoms && selectedCategory === 'tops')) throw new Error('Choose a photo matching your Tops or Bottoms filter.');
  return {unit: cm === inches ? null : cm ? 'cm' : 'in', basis: /\bbody\s+(?:size|measurements?)|\bto\s+fit\b/i.test(text) ? 'body' : 'garment', flat: /\bflat\b|\bpit[ -]to[ -]pit\b|\bhalf[ -](?:chest|waist|hip)\b/i.test(text)};
}
// Rebuild table rows from word positions, even when OCR emits one word per line.
function photoTableFromWords(words) {
  const clean = value => value.toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const usable = (words || []).filter(w => w.bbox && w.text.trim());
  const sizeHeader = usable.find(w => /^(SIZE|SIZES)$/.test(clean(w.text)));
  if (!sizeHeader) return '';
  const height = Math.max(1, sizeHeader.bbox.y1-sizeHeader.bbox.y0);
  const centerY = w => (w.bbox.y0+w.bbox.y1)/2;
  const centerX = w => (w.bbox.x0+w.bbox.x1)/2;
  const headers = usable.filter(w => Math.abs(centerY(w)-centerY(sizeHeader)) < height*1.2)
    .sort((a,b) => centerX(a)-centerX(b));
  const headerName = w => {
    const t=clean(w.text);
    return /^(SIZE|SIZES)$/.test(t) ? 'Size' : /^(CHEST|BUST)$/.test(t) ? 'Chest' : /^(LENGTH|LENGHT)$/.test(t) ? 'Length' : /^(WAIST|HIP|HIPS|SHOULDER|INSEAM)$/.test(t) ? t : 'Ignored';
  };
  if (!headers.some(w => headerName(w) === 'Chest' || headerName(w) === 'WAIST')) return '';
  const rows = [];
  const sizes = usable.filter(w => w.bbox.y0 > sizeHeader.bbox.y1 && /^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)$/.test(clean(w.text)) && Math.abs(centerX(w)-centerX(sizeHeader)) < height*3);
  for (const size of sizes.sort((a,b) => centerY(a)-centerY(b))) {
    const cells = headers.map(() => '');
    const rowWords = usable.filter(w => Math.abs(centerY(w)-centerY(size)) < height*.85);
    for (const w of rowWords) {
      let index=0;
      headers.forEach((h,i) => { if (Math.abs(centerX(w)-centerX(h)) < Math.abs(centerX(w)-centerX(headers[index]))) index=i; });
      if (cells[index]) { cells[index]='INVALID'; continue; }
      cells[index]=headerName(headers[index]) === 'Size' ? clean(w.text) : w.text.trim().replace(/,/g,'.');
    }
    if (cells.every((c,i) => headerName(headers[i]) === 'Ignored' || (headerName(headers[i]) === 'Size' ? !!c : /^\d+(?:\.\d+)?$/.test(c)))) rows.push(cells.join(','));
  }
  return rows.length ? [headers.map(headerName).join(','), ...rows].join('\n') : '';
}
async function rereadSizeColumn(worker, image, words) {
  const header = (words || []).find(w => /^sizes?$/i.test(w.text.trim()));
  const nextHeader = header && words.filter(w => w.bbox.x0 > header.bbox.x1 && Math.abs(w.bbox.y0-header.bbox.y0) < (header.bbox.y1-header.bbox.y0)*2).sort((a,b)=>a.bbox.x0-b.bbox.x0)[0];
  if (!header || !nextHeader) return words;
  const left = Math.max(0, header.bbox.x0 - (header.bbox.x1-header.bbox.x0));
  const right = Math.floor((header.bbox.x1+nextHeader.bbox.x0)/2);
  const top = header.bbox.y1 + 2;
  const crop = document.createElement('canvas');
  crop.width=right-left+40; crop.height=image.height-top+40;
  if (crop.height<=40 || crop.width<=40) return words;
  const ctx=crop.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,crop.width,crop.height);
  ctx.drawImage(image,left,top,right-left,image.height-top,20,20,right-left,image.height-top);
  await worker.setParameters({tessedit_pageseg_mode:'6',tessedit_char_whitelist:'XSML2345'});
  const {data} = await worker.recognize(crop);
  await worker.setParameters({tessedit_char_whitelist:''});
  const recovered=(data.words || []).filter(w=>/^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL)$/.test(w.text.trim())).map(w=>({...w,bbox:{x0:w.bbox.x0+left-20,x1:w.bbox.x1+left-20,y0:w.bbox.y0+top-20,y1:w.bbox.y1+top-20}}));
  if (!recovered.length) return words;
  return [...words.filter(w=>!(w.bbox.x0<right && w.bbox.y0>header.bbox.y1)), ...recovered];
}
async function rereadNumericCells(worker, image, words) {
  const header=words.find(w=>/^size$/i.test(w.text));
  if (!header) return words;
  const h=header.bbox.y1-header.bbox.y0;
  const headers=words.filter(w=>Math.abs(w.bbox.y0-header.bbox.y0)<h && /^(size|chest|bust|waist|hips?|length|shoulder|inseam|sleeve)$/i.test(w.text)).sort((a,b)=>a.bbox.x0-b.bbox.x0);
  if (headers.length<2) return words;
  const result=[...words];
  await worker.setParameters({tessedit_pageseg_mode:'13',tessedit_char_whitelist:'0123456789.-',classify_bln_numeric_mode:'1'});
  // Preserve valid whole-table readings; isolate only cells containing non-numeric glyphs.
  for (const word of words.filter(w=>w.bbox.y0>header.bbox.y1 && w.bbox.x0>headers[1].bbox.x0-30 && !/^\d+(?:\.\d+)?$/.test(w.text))) {
    const pad=16;
    const crop=document.createElement('canvas');crop.width=word.bbox.x1-word.bbox.x0+pad*2;crop.height=word.bbox.y1-word.bbox.y0+pad*2;
    const ctx=crop.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,crop.width,crop.height);
    ctx.drawImage(image,word.bbox.x0-3,word.bbox.y0-3,word.bbox.x1-word.bbox.x0+6,word.bbox.y1-word.bbox.y0+6,pad-3,pad-3,word.bbox.x1-word.bbox.x0+6,word.bbox.y1-word.bbox.y0+6);
    await worker.setParameters({tessedit_pageseg_mode:'13'});
    let {data}=await worker.recognize(crop);
    if (!/^\d+(?:\.\d+)?$/.test(data.text.trim())) {
      await worker.setParameters({tessedit_pageseg_mode:'7'});
      ({data}=await worker.recognize(crop));
    }
    const value=data.text.trim();
    if (/^\d+(?:\.\d+)?$/.test(value) && !/^\d+(?:\.\d+)?$/.test(word.text)) result[result.indexOf(word)]={...word,text:value};
  }
  await worker.setParameters({tessedit_char_whitelist:'',classify_bln_numeric_mode:'0'});
  return result;
}
function completePhotoSizes(rows, observed) {
  const order=['XXXS','XXS','XS','S','M','L','XL','XXL','XXXL'];
  const sizes=rows.map(row=>row.size.toUpperCase());
  if ([...observed].some(size=>!sizes.includes(size))) return false;
  const indexes=sizes.map(size=>order.indexOf(size)).filter(i=>i>=0).sort((a,b)=>a-b);
  return rows.length>=2 && indexes.every((n,i)=>!i || n-indexes[i-1]<=1);
}
function validPhotoRows(rows) {
  const seen = new Set();
  return rows.filter(row => {
    if (!/^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-5]XL|\d{1,3})$/i.test(row.size) || seen.has(row.size)) return false;
    const values=Object.entries(row).filter(([key]) => key !== 'size');
    if (!values.length || !values.every(([,value]) => /^\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?$/.test(String(value)) && String(value).split('-').every(n => +n > 0 && +n <= 300))) return false;
    seen.add(row.size); return true;
  });
}
function normalizePhotoTable(text) {
  return text.split(/\r?\n/).map(line => line.trim()
    .replace(/\b(chest|body|sleeve|shoulder)\s+(width|length)\b/gi, '$1_$2')
    .replace(/\s+\((cm|in|inches)\)/gi, '($1)')
    .replace(/\s*[|]\s*/g, ',').replace(/\s+/g, ',')).join('\n');
}
$('#chart-photo-form').addEventListener('submit', async e => {
  e.preventDefault();
  let worker;
  const job = ++photoJob;
  const photoGender = gender, photoCategory = category;
  pendingPhotoChart = null; $('#photo-unit-choice').hidden = true;
  const button = $('#read-chart-photo');
  try {
    const file = selectedChartPhoto();
    button.disabled = true; $('#chart-photo').disabled = true;
    button.textContent = 'Reading…'; $('#photo-status').textContent = 'Loading photo reader…';
    const reader = await loadPhotoReader();
    if (job !== photoJob) return;
    worker = await reader.createWorker('eng', 1, { logger: progress => {
      if (job === photoJob && progress.status === 'recognizing text') $('#photo-status').textContent = `Reading chart: ${Math.round(progress.progress * 100)}%`;
    } });
    if (job !== photoJob) { await worker.terminate(); return; }
    activePhotoWorker = worker;
    await worker.setParameters({preserve_interword_spaces: '1', tessedit_pageseg_mode: '11'});
    let bestText = '', bestRows = [], bestInfo = null, detectionError = null;
    const observedSizes = new Set();
    for (const pass of [{mode:'6'}, {mode:'11'}, {mode:'6', threshold:true}, {mode:'4'}, {mode:'11', threshold:true}]) {
      const lowerHalf = !!pass.lowerHalf;
      if (job !== photoJob) return;
      $('#photo-status').textContent = lowerHalf ? 'Taking a closer look at the chart…' : 'Enhancing small text…';
      const image = await prepareChartPhoto(file, lowerHalf, !!pass.threshold);
      await worker.setParameters({tessedit_pageseg_mode: pass.mode});
      const {data} = await worker.recognize(image);
      const {text} = data;
      let rebuiltWords = await rereadSizeColumn(worker, image, data.words || []);
      rebuiltWords = await rereadNumericCells(worker, image, rebuiltWords);
      for (const word of rebuiltWords) if (/^(XS|S|M|L|XL|XXL|XXXL)$/.test(word.text.trim())) observedSizes.add(word.text.trim());
      if (job !== photoJob) return;
      let info;
      try { info = detectPhotoChart(text, photoGender, photoCategory); } catch (err) { detectionError = err; continue; }
      const normalized = photoTableFromWords(rebuiltWords) || normalizePhotoTable(text);
      const parsed = await api('parse', {text: normalized, unit: info.unit || 'cm'});
      if (job !== photoJob) return;
      parsed.chart = validPhotoRows(parsed.chart);
      if (parsed.chart.length > bestRows.length || (!bestText && text.trim())) { bestRows = parsed.chart; bestText = normalized; bestInfo = info; }
      if (bestRows.length >= 5 && completePhotoSizes(bestRows, observedSizes)) break;
    }
    if (gender !== photoGender || category !== photoCategory) throw new Error('Filters changed. Read the chart again with your current selection.');
    if (!bestRows.length && detectionError) throw detectionError;
    if (!bestRows.length) {
      $('#photo-status').textContent = 'The chart numbers are still too unclear to use. Try a closer screenshot of just the table.';
      notice('No readable size table found. Your current chart has not been changed.');
      return;
    }
    if (!completePhotoSizes(bestRows, observedSizes)) {
      chart = []; preview();
      throw new Error('Some size rows could not be read reliably. Please use a larger chart image so every size can be compared.');
    }
    if (!bestInfo.unit) {
      pendingPhotoChart = {text:bestText, info:bestInfo, chartGender:photoGender, chartCategory:photoCategory, job};
      $('#photo-unit-choice').hidden = false;
      $('#photo-status').textContent = 'Chart found. Confirm the unit to continue.';
      $('#status').textContent = '';
      return;
    }
    applyPhotoChart(bestRows, bestInfo, bestText, photoGender, photoCategory);
  } catch (err) { if (job === photoJob) $('#photo-status').textContent = err.message || 'Could not read this photo. Try another image.'; }
  finally {
    if (worker) await worker.terminate().catch(() => {});
    if (job === photoJob) { activePhotoWorker = null; button.disabled = false; $('#chart-photo').disabled = false; button.textContent = 'Read chart'; }
  }
});

function applyPhotoChart(rows, info, text, chartGender, chartCategory) {
  referenceCategory = null; chart = rows;
    if (info.flat && info.basis === 'garment') for (const row of chart) for (const field of ['chest','waist','hip']) {
      if (row[field] != null) row[field] = String(row[field]).split('-').map(value => +(Number(value) * 2).toFixed(2)).join('-');
    }
    analyzedGender = chartGender; analyzedCategory = chartCategory;
    $('#chart-unit').value = info.unit; $('#basis').value = info.basis;
    $('#chart-text').value = text; photoExtractedText = text;
    preview();
    $('#photo-status').textContent = 'Chart ready. Fit results are estimates.';
    notice('Chart analyzed. Ready to compare.', true);
    if (readProfile()[category === 'tops' ? 'chest' : 'waist']) $('#calculate').click();
}

$('#photo-unit-choice').addEventListener('click', async e => {
  const chosenUnit = e.target.dataset.photoUnit;
  const pending = pendingPhotoChart;
  if (!['in','cm'].includes(chosenUnit) || !pending) return;
  if (pending.chartGender !== gender || pending.chartCategory !== category || pending.job !== photoJob) {
    pendingPhotoChart = null; $('#photo-unit-choice').hidden = true;
    $('#photo-status').textContent = 'Your selection changed. Read the photo again.'; return;
  }
  const buttons = [...document.querySelectorAll('[data-photo-unit]')];
  buttons.forEach(button => button.disabled = true);
  try {
    const {chart: rows} = await api('parse', {text:pending.text, unit:chosenUnit});
    if (pendingPhotoChart !== pending || pending.job !== photoJob) return;
    if (!rows.length) throw new Error('The numbers could not be read. Try a closer photo of the table.');
    if (pending.chartGender !== gender || pending.chartCategory !== category) throw new Error('Your selection changed. Read the photo again.');
    pendingPhotoChart = null; $('#photo-unit-choice').hidden = true;
    applyPhotoChart(rows, {...pending.info, unit:chosenUnit}, pending.text, pending.chartGender, pending.chartCategory);
  } catch (err) { if (pending.job === photoJob) $('#photo-status').textContent = err.message; }
  finally { buttons.forEach(button => button.disabled = false); }
});

// Studio interactions stay independent of chart parsing and scoring.
const garment = document.querySelector('#garment-object');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let garmentTurn = -12;
function turnGarment(delta) { garmentTurn = Math.max(-50, Math.min(50, garmentTurn + delta)); garment.style.setProperty('--turn', `${garmentTurn}deg`); }
$('#rotate-left').addEventListener('click', () => turnGarment(-15));
$('#rotate-right').addEventListener('click', () => turnGarment(15));
$('#reset-garment').addEventListener('click', () => { garmentTurn = 0; turnGarment(0); });
garment.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || reducedMotion.matches) return; const rect = garment.getBoundingClientRect(); garment.style.setProperty('--turn', `${garmentTurn + (e.clientX-rect.left-rect.width/2)/rect.width*14}deg`); });
garment.addEventListener('pointerleave', () => turnGarment(0));
$('#profile-form').addEventListener('focusin', e => { const field=e.target.id; document.querySelectorAll('[data-guide]').forEach(g=>g.classList.toggle('active',g.dataset.guide===field)); $('#guide-caption').textContent = names[field] ? `${names[field].toUpperCase()} / MEASURE YOURSELF, NOT THE ILLUSTRATION` : 'FOCUS A MEASUREMENT TO SEE ITS GUIDE'; });
$('#profile-form').addEventListener('focusout', () => { document.querySelectorAll('[data-guide]').forEach(g=>g.classList.remove('active')); $('#guide-caption').textContent = 'FOCUS A MEASUREMENT TO SEE ITS GUIDE'; });
$('#categories').addEventListener('click', () => { $('#required-note').textContent = category==='tops' ? 'Chest is required for tops. Everything else refines the estimate.' : 'Waist is required for bottoms. Everything else refines the estimate.'; });
const dropZone=$('#chart-photo-form');
for(const event of ['dragenter','dragover']) dropZone.addEventListener(event,e=>{e.preventDefault();if(!$('#chart-photo').disabled)dropZone.classList.add('dragging');});
dropZone.addEventListener('dragleave',e=>{if(!dropZone.contains(e.relatedTarget))dropZone.classList.remove('dragging');});
dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('dragging');if($('#chart-photo').disabled)return;const files=e.dataTransfer.files;if(files.length!==1){$('#photo-status').textContent='Please drop one size-chart image at a time.';return;}$('#chart-photo').files=files;$('#chart-photo').dispatchEvent(new Event('change',{bubbles:true}));});
document.addEventListener('visibilitychange',()=>document.body.classList.toggle('page-hidden',document.hidden));
new IntersectionObserver(entries=>{for(const entry of entries)entry.target.style.animationPlayState=entry.isIntersecting?'running':'paused';}).observe($('.scan-loader span'));
