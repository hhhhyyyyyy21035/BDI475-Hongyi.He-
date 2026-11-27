'use strict';

const stateNames = {CA:'California',FL:'Florida',GA:'Georgia',IA:'Iowa',IL:'Illinois',IN:'Indiana',MI:'Michigan',NC:'North Carolina',PA:'Pennsylvania',VA:'Virginia',WI:'Wisconsin'};
const number = new Intl.NumberFormat('en-US');
const moneyWhole = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0});
const moneyCents = new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
const money = value => value === null ? '—' : (Number.isInteger(value) ? moneyWhole : moneyCents).format(value);
let dataset = null;
const $ = id => document.getElementById(id);

function median(prices) {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a,b) => a-b);
  const middle = Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
}

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function priceScope(data) {
  return `${money(data.price_floor)}–${money(data.price_ceiling)}`;
}

function priceBar(city, maxPrice, emphasis) {
  const row = make('div', `chart-row ${emphasis}`);
  const label = make('div', 'chart-label', city.city);
  label.append(make('span', '', ` ${city.state}`));
  const track = make('div', 'bar-track');
  track.setAttribute('aria-hidden', 'true');
  if (city.median !== null && maxPrice > 0) {
    const bar = make('div', 'bar-fill');
    bar.style.width = `${city.median / maxPrice * 100}%`;
    track.append(bar);
  }
  row.append(label, track, make('div', 'chart-value', money(city.median)));
  row.title = `${city.city}, ${city.state} · ${money(city.median)} median · ${number.format(city.count)} eligible sales`;
  return row;
}

function renderQ1(data) {
  const cities = [...data.cities].sort((a, b) => (b.median ?? -Infinity) - (a.median ?? -Infinity)
    || a.city.localeCompare(b.city) || a.state.localeCompare(b.state));
  const topPrice = cities[0].median;
  if (topPrice === null) {
    $('q1-answer').textContent = 'No sales fall within the price scope.';
    return;
  }
  const leaders = cities.filter(city => city.median === topPrice);
  const cityNames = new Intl.ListFormat('en-US').format(leaders.map(city => `${city.city}, ${city.state}`));
  $('q1-answer').textContent = `The highest median sale price is ${money(topPrice)} in ${cityNames}.`;
  $('q1-chart').replaceChildren(...cities.map(city => priceBar(city, topPrice,
    city.median === topPrice ? 'top-price-row' : '')));
  $('q1-scope').textContent = `${number.format(data.eligible_count)} eligible sales · ${priceScope(data)} inclusive · Bars start at $0`;
  $('q1-figure').hidden = false;
}

function render() {
  if (!dataset) return;
  const state = $('state-filter').value;
  const query = $('city-search').value.trim().toLocaleLowerCase('en-US');
  const cities = dataset.cities.filter(item => (!state || item.state === state) && item.city.toLocaleLowerCase('en-US').includes(query));
  const sorters = {
    'price-desc': (a,b) => (b.median ?? -Infinity)-(a.median ?? -Infinity),
    'price-asc': (a,b) => (a.median ?? Infinity)-(b.median ?? Infinity),
    'count-desc': (a,b) => b.count-a.count,
    'city-asc': (a,b) => a.city.localeCompare(b.city,'en-US'),
  };
  cities.sort((a,b) => (sorters[$('sort-order').value] || sorters['price-desc'])(a,b) || a.city.localeCompare(b.city,'en-US') || a.state.localeCompare(b.state));
  const prices = cities.flatMap(item => item.prices);
  const excluded = cities.reduce((sum,item) => sum+item.excluded_count,0);
  const rawCount = cities.reduce((sum,item) => sum+item.source_count,0);
  const states = new Set(cities.map(item => item.state));
  $('stat-sales').textContent = number.format(prices.length);
  $('stat-price').textContent = money(median(prices));
  $('stat-cities').textContent = number.format(cities.length);
  $('stat-states').textContent = `Across ${number.format(states.size)} ${states.size===1?'state':'states'}`;
  $('stat-source-note').textContent = `${number.format(rawCount)} source records · ${number.format(excluded)} excluded`;
  $('load-status').textContent = `${state ? stateNames[state] || state : 'All states'} · ${number.format(cities.length)} ${cities.length===1?'city':'cities'} in view · Sale price ${priceScope(dataset)}`;
  $('table-count').textContent = `${number.format(cities.length)} ${cities.length===1?'city':'cities'}`;
  $('empty-state').hidden = cities.length > 0;
  $('illinois-focus').setAttribute('aria-pressed', String(state === 'IL' && !query));
  $('city-chart').replaceChildren();
  $('city-table').replaceChildren();
  const chart = document.createDocumentFragment();
  const table = document.createDocumentFragment();
  const maxPrice = Math.max(0,...cities.map(item => item.median ?? 0));
  for (const city of cities) {
    chart.append(priceBar(city, maxPrice, city.state === 'IL' ? 'local-row' : ''));
    const tr = make('tr');
    const cityCell = make('td','',city.city);
    if (city.state === 'IL') cityCell.append(make('span','illinois-badge','Illinois'));
    const stateCell = make('td');
    const badge = make('span','state-badge',city.state);
    badge.title = stateNames[city.state] || city.state;
    stateCell.append(badge);
    tr.append(cityCell,stateCell,make('td','number-cell',number.format(city.count)),make('td','number-cell',money(city.median)),make('td','number-cell',number.format(city.excluded_count)));
    table.append(tr);
  }
  $('city-chart').append(chart);
  $('city-table').append(table);
}

async function load() {
  $('load-error').hidden = true;
  $('load-status').textContent = 'Loading the sales data…';
  $('q1-answer').textContent = 'Loading the sales data…';
  $('q1-figure').hidden = true;
  try {
    const response = await fetch('data/city_summary.json');
    if (!response.ok) throw new Error(`Data request failed (${response.status})`);
    const data = await response.json();
    if (!Array.isArray(data.cities) || !data.cities.length
        || !Number.isFinite(data.price_floor) || !Number.isFinite(data.price_ceiling)
        || data.price_floor > data.price_ceiling) throw new Error('Invalid summary structure');
    dataset = data;
    const selected = $('state-filter').value;
    $('state-filter').replaceChildren(make('option','','All states'));
    $('state-filter').firstElementChild.value = '';
    [...new Set(data.cities.map(item => item.state))].sort((a,b) => (stateNames[a]||a).localeCompare(stateNames[b]||b)).forEach(state => {
      const option = make('option','',`${stateNames[state]||state} (${state})`);
      option.value = state;
      $('state-filter').append(option);
    });
    $('state-filter').value = selected;
    $('price-rule').textContent = `Q1 and the city explorer include sale prices in ${priceScope(data)}, including both endpoints.`;
    $('dataset-count-note').textContent = `Of ${number.format(data.source_count)} source records, ${number.format(data.eligible_count)} meet this price scope and ${number.format(data.excluded_count)} fall outside it.`;
    renderQ1(data);
    render();
  } catch (error) {
    $('load-status').textContent = 'Sales data unavailable.';
    $('q1-answer').textContent = 'Sales data unavailable. Use the retry button in the city explorer.';
    $('q1-figure').hidden = true;
    $('load-error').hidden = false;
    console.error('Dashboard data loading error:',error);
  }
}

$('state-filter').addEventListener('change',render);
$('city-search').addEventListener('input',render);
$('sort-order').addEventListener('change',render);
$('reset').addEventListener('click',() => {
  $('state-filter').value = '';
  $('city-search').value = '';
  $('sort-order').value = 'price-desc';
  render();
});
$('filters').addEventListener('submit',event => event.preventDefault());
$('illinois-focus').addEventListener('click',() => {
  $('state-filter').value = 'IL';
  $('city-search').value = '';
  render();
  $('explore-title').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
});
$('retry').addEventListener('click',load);
load();
