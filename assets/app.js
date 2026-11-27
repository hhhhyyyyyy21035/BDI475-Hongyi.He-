'use strict';

const byId = id => document.getElementById(id);
const countFormat = new Intl.NumberFormat('en-US');
const dayFormat = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1});
const retry = byId('retry-load');
const theme = byId('theme-toggle');

function synchronizeTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  theme.setAttribute('aria-pressed', String(dark));
  theme.textContent = dark ? 'Light mode' : 'Dark mode';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#122322' : '#f6f5ef';
}

theme.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  synchronizeTheme();
  try {
    localStorage.setItem('campus-comps-theme', next);
  } catch {}
});
synchronizeTheme();

function element(tag, value) {
  const node = document.createElement(tag);
  node.textContent = value;
  return node;
}

function showDateInsight(data) {
  const f = countFormat.format.bind(countFormat);
  const d = dayFormat.format.bind(dayFormat);
  const city = 'Pittsboro, NC';
  const samples = [
    ['All scoped sales', data.scoped],
    [city, data.scoped.filter(row => row.city === city)],
  ];
  const summaries = samples.map(([location, rows]) => {
    const known = rows.flatMap(row => row.dom === null ? [] : [row.dom]);
    return {
      location,
      observed: known.length,
      missing: rows.length - known.length,
      median: CampusData.median(known),
      zeroFilled: CampusData.median(rows.map(row => row.dom ?? 0)),
    };
  });
  const [overall, example] = summaries;
  const description = element('p', `The listing or contract date is missing on ${f(overall.missing)} sales in the price scope. I calculated days on market only for sales that recorded both dates and kept same-day contracts as zero days. A closing date does not tell us when the offer was accepted, so it cannot replace the contract date. It also matters which sales have blank dates. The dataset notes that sales without a listing are more common for newer homes. The median therefore describes the sales with recorded listing and contract dates, and the mix of those sales may differ from the overall market.`);
  const effect = element('p', `Counting every blank as zero would move the median from ${d(overall.median)} to ${d(overall.zeroFilled)} days across the dataset. In ${city}, only ${f(example.observed)} sales have both dates and ${f(example.missing)} are missing at least one. The median there drops from ${d(example.median)} days to ${d(example.zeroFilled)} days when blanks are coded as zero. That would make homes with undocumented marketing times look like instant sales. Keeping the observed-sale count beside the days-on-market results helps readers decide how much weight to put on comparisons between markets.`);
  const table = document.createElement('table');
  table.className = 'insight-table';
  table.append(element('caption', 'Sensitivity of median days on market to missing dates'));
  const header = table.createTHead().insertRow();
  const columns = ['Dataset', 'Sales with both dates', 'Sales missing a date', 'Observed median', 'Zero-filled median'];
  for (const label of columns) {
    const cell = element('th', label);
    cell.scope = 'col';
    header.append(cell);
  }
  const body = table.createTBody();
  for (const row of summaries) {
    const line = body.insertRow();
    [row.location, f(row.observed), f(row.missing), `${d(row.median)} days`, `${d(row.zeroFilled)} days`].forEach((value, index) => {
      const cell = element(index === 0 ? 'th' : 'td', value);
      if (index === 0) cell.scope = 'row';
      else cell.dataset.label = columns[index];
      line.append(cell);
    });
  }
  byId('date-insight').replaceChildren(description, effect, table);
}

async function start() {
  const status = byId('load-status');
  byId('load-panel').hidden = false;
  status.textContent = 'Loading the sales data…';
  retry.hidden = true;
  try {
    const data = await CampusData.load();
    const fixed = CampusData.fixed(data);
    CampusExplorer.mount(byId('explorer-root'), data);
    CampusQuestions.mount(byId('questions-root'), data, fixed);
    showDateInsight(data);
    byId('overview-sales').textContent = countFormat.format(data.rows.length);
    byId('overview-cities').textContent = countFormat.format(data.cities.length);
    byId('overview-campuses').textContent = countFormat.format(data.campuses.length);
    for (const id of ['dataset-overview', 'explore', 'questions', 'insights']) byId(id).hidden = false;
    byId('load-panel').hidden = true;
    const anchor = document.getElementById(location.hash.slice(1));
    if (anchor) anchor.scrollIntoView();
  } catch (error) {
    status.textContent = 'The sales data could not be loaded. Check your connection and try again.';
    retry.hidden = false;
    console.error(error);
  }
}

retry.addEventListener('click', start);
start();
