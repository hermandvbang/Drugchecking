const $ = (selector) => document.querySelector(selector);
const pageSize = 18;
let records = [];
let page = 1;
const clean = (value, fallback = 'Not recorded') => String(value ?? '').trim() || fallback;
const escapeHTML = (value) => clean(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
const countBy = (items, getValue) => items.reduce((map, item) => { const value = clean(getValue(item)); map.set(value, (map.get(value) || 0) + 1); return map; }, new Map());
const ordered = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const percent = (count, total) => total ? ((count / total) * 100).toFixed(1) : '0.0';

function renderSummary() {
  const fts = countBy(records, (record) => record.ftsResult);
  const tested = (fts.get('Positive') || 0) + (fts.get('Negative') || 0);
  const fentanyl = records.filter((record) => /fentanyl/i.test(clean(record.ftirSubstances, ''))).length;
  const xylazine = records.filter((record) => /xylazine/i.test(clean(record.ftirSubstances, ''))).length;
  const both = records.filter((record) => /fentanyl/i.test(clean(record.ftirSubstances, '')) && /xylazine/i.test(clean(record.ftirSubstances, ''))).length;
  $('#metrics').innerHTML = [[records.length.toLocaleString(), 'Samples in view', ''], [fentanyl.toLocaleString(), 'FTIR results mentioning fentanyl', 'highlight'], [xylazine.toLocaleString(), 'FTIR results mentioning xylazine', ''], [`${percent(fts.get('Positive') || 0, tested)}%`, 'FTS positive among tested', '']].map(([value, label, extra]) => `<article class="metric ${extra}"><span class="value">${value}</span><span class="label">${label}</span></article>`).join('');
  $('#coOccurrenceCopy').textContent = `${both.toLocaleString()} samples mention both fentanyl and xylazine in their FTIR substance result — ${percent(both, records.length)}% of all records and ${percent(both, fentanyl)}% of those mentioning fentanyl.`;
  $('#signalBars').innerHTML = [['Fentanyl mentioned', fentanyl], ['Xylazine mentioned', xylazine], ['Both mentioned', both]].map(([label, count]) => `<div class="signal-row"><span>${label}</span><div class="signal-track"><div class="signal-fill" style="width:${percent(count, records.length)}%"></div></div><strong>${count}</strong></div>`).join('');
  $('#ftsTested').textContent = `${tested.toLocaleString()} tested`;
  const colors = { Positive: '#ff796a', Negative: '#6cae91', 'Not Tested': '#bdc6bd', 'Not recorded': '#dfe4dd' };
  $('#ftsBar').innerHTML = ordered(fts).map(([label, count]) => `<span style="width:${percent(count, records.length)}%;background:${colors[label] || '#84958b'}"></span>`).join('');
  $('#ftsLegend').innerHTML = ordered(fts).map(([label, count]) => `<span><i class="dot" style="background:${colors[label] || '#84958b'}"></i>${escapeHTML(label)} <strong>${count}</strong></span>`).join('');
}
function renderRankings() {
  const substances = ordered(countBy(records, (record) => record.ftirSubstances)).filter(([name]) => name !== 'Not recorded').slice(0, 8);
  $('#substanceList').innerHTML = substances.map(([name, count], index) => `<li><span class="rank">${String(index + 1).padStart(2, '0')}</span><span class="substance" title="${escapeHTML(name)}">${escapeHTML(name)}</span><span class="count">${count}</span></li>`).join('');
  const forms = ordered(countBy(records, (record) => record.sampleForm)).slice(0, 8); const maximum = forms[0]?.[1] || 1;
  $('#formChart').innerHTML = forms.map(([name, count]) => `<div class="form-row"><span>${escapeHTML(name)}</span><div class="form-track"><div class="form-fill" style="width:${percent(count, maximum)}%"></div></div><strong>${count}</strong></div>`).join('');
}
function populateFilters() {
  const addOptions = (selector, values) => { const element = $(selector); element.innerHTML = `<option value="">All ${selector === '#ftsFilter' ? 'results' : 'forms'}</option>${values.map(([value]) => `<option value="${escapeHTML(value)}">${escapeHTML(value)}</option>`).join('')}`; };
  addOptions('#ftsFilter', ordered(countBy(records, (record) => record.ftsResult))); addOptions('#formFilter', ordered(countBy(records, (record) => record.sampleForm)));
}
function filteredRecords() {
  const search = $('#searchInput').value.toLowerCase().trim(); const fts = $('#ftsFilter').value; const form = $('#formFilter').value;
  return records.filter((record) => { const searchable = [record.labCode, record.acquiredOn, record.town, record.neighborhood, record.sampleForm, record.suspected, record.soldAs, record.ftirSubstances, record.ftsResult].map((value) => clean(value, '')).join(' ').toLowerCase(); return (!search || searchable.includes(search)) && (!fts || clean(record.ftsResult) === fts) && (!form || clean(record.sampleForm) === form); });
}
function renderRecords() {
  const filtered = filteredRecords(); const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)); page = Math.min(page, totalPages); const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  $('#resultsCount').textContent = `${filtered.length.toLocaleString()} matching records`;
  $('#recordRows').innerHTML = visible.map((record) => { const fts = clean(record.ftsResult); const area = [clean(record.town, ''), clean(record.neighborhood, '')].filter(Boolean).join(' · ') || 'Not recorded'; const identity = [clean(record.suspected, ''), clean(record.soldAs, '')].filter(Boolean).join(' / ') || 'Not recorded'; return `<tr><td class="code">${escapeHTML(record.labCode)}</td><td>${escapeHTML(record.acquiredOn)}</td><td>${escapeHTML(record.sampleForm)}</td><td>${escapeHTML(identity)}</td><td title="${escapeHTML(record.ftirSubstances)}">${escapeHTML(record.ftirSubstances)}</td><td><span class="pill ${fts === 'Positive' ? 'positive' : ''}">${escapeHTML(fts)}</span></td><td>${escapeHTML(area)}</td></tr>`; }).join('') || '<tr><td colspan="7">No records match those filters.</td></tr>';
  $('#pageLabel').textContent = `Page ${page} of ${totalPages}`; $('#previousPage').disabled = page === 1; $('#nextPage').disabled = page === totalPages;
}
function renderError() { document.querySelector('main').replaceWith($('#errorTemplate').content.cloneNode(true)); }
async function init() {
  try { const response = await fetch('data/records.json'); if (!response.ok) throw new Error('Data unavailable'); records = (await response.json()).records; $('#refreshNote').textContent = `${records.length.toLocaleString()} published records loaded`; renderSummary(); renderRankings(); populateFilters(); renderRecords(); ['#searchInput', '#ftsFilter', '#formFilter'].forEach((selector) => $(selector).addEventListener('input', () => { page = 1; renderRecords(); })); $('#previousPage').addEventListener('click', () => { page -= 1; renderRecords(); }); $('#nextPage').addEventListener('click', () => { page += 1; renderRecords(); }); } catch (error) { renderError(); }
}
init();
