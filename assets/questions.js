'use strict';

window.CampusQuestions = (() => {
  const usd = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2,
  });
  const number = new Intl.NumberFormat('en-US', {maximumFractionDigits: 1});
  const percentage = new Intl.NumberFormat('en-US', {
    style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1,
  });
  const taxPercentage = new Intl.NumberFormat('en-US', {
    style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const names = new Intl.ListFormat('en-US', {style: 'long', type: 'conjunction'});
  const months = Array.from({length: 12}, (_, i) =>
    new Intl.DateTimeFormat('en-US', {month: 'long', timeZone: 'UTC'}).format(new Date(Date.UTC(2025, i))));
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const scope = 'Sale prices from $10,000 to $5,000,000, inclusive.';
  const format = (value, formatter) => Number.isFinite(value) ? formatter.format(value) : '—';
  const money = value => format(value, usd);
  const count = value => format(value, number);
  const percent = value => format(value, percentage);
  const taxPercent = value => format(value, taxPercentage);
  const days = value => Number.isFinite(value) ? `${count(value)} days` : '—';
  const miles = value => Number.isFinite(value) ? `${count(value)} mi` : '—';
  const signedPercent = value => value > 0 ? `+${percent(value)}` : percent(value);
  const byValue = (key, descending = true) => (a, b) => {
    if (!Number.isFinite(a[key])) return Number.isFinite(b[key]) ? 1 : 0;
    if (!Number.isFinite(b[key])) return -1;
    return descending ? b[key] - a[key] : a[key] - b[key];
  };

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svg(tag, attributes) {
    const node = document.createElementNS(svgNamespace, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    return node;
  }

  function extremes(rows, key, highest = true) {
    const values = rows.map(row => row[key]).filter(Number.isFinite);
    if (!values.length) return [];
    const target = highest ? Math.max(...values) : Math.min(...values);
    return rows.filter(row => row[key] === target);
  }

  function highlighted(leaders, key) {
    return new Set(leaders.map(row => row[key]));
  }

  function describe(rows, key, valueKey, formatter) {
    if (!rows.length) return 'No qualifying results';
    return `${names.format(rows.map(row => row[key]))} (${formatter(rows[0][valueKey])})`;
  }

  function figure(title, note) {
    const body = make('figure', 'question-figure');
    body.append(make('figcaption', 'question-chart-title', title));
    const foot = make('p', 'question-chart-note', note);
    return {body, foot};
  }

  function barChart(rows, settings) {
    const {title, note, nameKey, series, leaders = new Set(), detail} = settings;
    const {body, foot} = figure(title, note);
    const values = rows.flatMap(row => series.map(line => row[line.key]).filter(Number.isFinite));
    if (!rows.length) {
      body.append(make('p', 'question-empty', 'No results for these settings.'), foot);
      return body;
    }

    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    const span = max - min || 1;
    const zero = -min / span * 100;
    const dataList = make('ul', 'question-bars');

    if (series.length > 1) {
      const legend = make('ul', 'question-legend');
      for (const [index, line] of series.entries()) {
        legend.append(make('li', `question-series-${index}`, line.label));
      }
      body.append(legend);
    }

    if (values.length) {
      const scale = make('div', 'question-scale');
      scale.setAttribute('aria-hidden', 'true');
      scale.append(make('span', '', series[0].format(min)), make('span', '', series[0].format(max)));
      const unit = make('div', 'question-scale-row');
      unit.append(make('span'), scale, make('span'));
      body.append(unit);
    }

    for (const row of rows) {
      const item = make('li', 'question-bar-row');
      if (leaders.has(row[nameKey])) item.classList.add('question-highlight');
      const name = make('div', 'question-bar-name', row[nameKey]);
      if (detail) name.append(make('small', 'question-row-detail', detail(row)));
      const charts = make('div', 'question-bar-series');
      const labels = make('div', 'question-bar-values');
      for (const [index, line] of series.entries()) {
        const value = row[line.key];
        const track = make('div', 'question-bar-track');
        track.setAttribute('aria-hidden', 'true');
        track.style.setProperty('--question-zero', `${zero}%`);
        if (Number.isFinite(value)) {
          const edge = (value - min) / span * 100;
          const fill = make('span', `question-bar-fill question-series-${index}`);
          fill.style.setProperty('--bar-start', `${Math.min(zero, edge)}%`);
          fill.style.setProperty('--bar-width', `${Math.abs(edge - zero)}%`);
          track.append(fill);
        }
        charts.append(track);
        const label = make('span', 'question-value');
        if (series.length > 1) label.append(make('span', 'question-sr-only', `${line.label} `));
        label.append(document.createTextNode(line.format(value)));
        labels.append(label);
      }
      item.append(name, charts, labels);
      dataList.append(item);
    }
    body.append(dataList, foot);
    return body;
  }

  function singleSeries(key, formatter) {
    return [{key, format: formatter}];
  }

  function rankChart(rows) {
    const {body, foot} = figure('City rankings by mean sale price', 'Rank 1 is the highest mean. Highlighted lines show cities whose ranks changed.');
    const raw = [...rows].sort((a, b) => a.rawRank - b.rawRank || a.city.localeCompare(b.city));
    const scoped = [...rows].sort((a, b) => a.scopedRank - b.scopedRank || a.city.localeCompare(b.city));
    const plot = make('div', 'question-rank-plot');
    const allColumn = make('ol', 'question-rank-column');
    const scopedColumn = make('ol', 'question-rank-column question-rank-right');
    const connectors = make('div', 'question-rank-connectors');
    const coords = svg('svg', {
      viewBox: `0 0 100 ${rows.length * 20}`, preserveAspectRatio: 'none', 'aria-hidden': 'true',
    });
    const scopedPosition = new Map(scoped.map((row, i) => [row.city, i]));

    const rankLabel = (row, rank) => {
      const label = make('li', row.change ? 'question-rank-changed' : '');
      label.append(make('span', 'question-rank-number', String(rank)), make('span', 'question-rank-city', row.city));
      return label;
    };

    for (const [i, row] of raw.entries()) {
      allColumn.append(rankLabel(row, row.rawRank));
      const pair = svg('line', {x1: 0, y1: i * 20 + 10, x2: 100,
        y2: scopedPosition.get(row.city) * 20 + 10, 'vector-effect': 'non-scaling-stroke'});
      if (row.change) pair.setAttribute('class', 'question-rank-line-changed');
      coords.append(pair);
    }

    for (const row of scoped) scopedColumn.append(rankLabel(row, row.scopedRank));
    const heading = make('div', 'question-rank-head');
    heading.append(make('span', '', 'All sales'), make('span', '', 'Within price scope'));
    connectors.append(coords);
    plot.append(allColumn, connectors, scopedColumn);
    body.append(heading, plot, foot);

    const details = make('details', 'question-table-details');
    details.append(make('summary', '', 'Mean prices and ranks for every city'));
    const table = make('table', 'question-rank-table');
    const thead = make('thead');
    const header = make('tr');
    for (const title of ['City', 'All sales', 'Within price scope']) {
      const th = make('th', '', title);
      th.scope = 'col';
      header.append(th);
    }
    thead.append(header);
    const tbody = make('tbody');
    for (const row of raw) {
      const tr = make('tr');
      const city = make('th', '', row.city);
      city.scope = 'row';
      const rawValue = make('td', '', money(row.rawMean));
      rawValue.append(make('small', '', `Rank ${row.rawRank}`));
      const scopedValue = make('td', '', money(row.scopedMean));
      scopedValue.append(make('small', '', `Rank ${row.scopedRank}`));
      tr.append(city, rawValue, scopedValue);
      tbody.append(tr);
    }
    table.append(thead, tbody);
    details.append(table);
    body.append(details);
    return body;
  }

  function monthlyChart(rows, winners) {
    const {body, foot} = figure('Sales recorded by month', 'Months follow the closing date. Each monthly count includes all recorded prices.');
    const max = Math.max(...rows.map(row => row.count), 1);
    const x = (index) => 25 + index * 50;
    const y = (value) => 126 - value / max * 108;
    const plot = svg('svg', {viewBox: '0 0 600 140', preserveAspectRatio: 'none', 'aria-hidden': 'true'});
    plot.setAttribute('class', 'question-month-plot');
    for (const line of [18, 72, 126]) {
      plot.append(svg('line', {x1: 25, x2: 575, y1: line, y2: line, class: 'question-month-guide',
        'vector-effect': 'non-scaling-stroke'}));
    }
    plot.append(svg('polyline', {
      points: rows.map((row, i) => `${x(i)},${y(row.count)}`).join(' '),
      class: 'question-month-line', 'vector-effect': 'non-scaling-stroke',
    }));
    for (const [index, row] of rows.entries()) {
      plot.append(svg('circle', {cx: x(index), cy: y(row.count), r: winners.has(row.month) ? 5 : 3,
        class: winners.has(row.month) ? 'question-month-point question-month-high' : 'question-month-point'}));
    }
    const axes = make('div', 'question-month-axes');
    const yAxis = make('span', '', 'Sales');
    const limits = make('span', '', `0 to ${count(max)}`);
    const xAxis = make('span', '', 'Month');
    axes.append(yAxis, limits, xAxis);
    const labels = make('ol', 'question-month-values');
    for (const row of rows) {
      const name = months[row.month - 1];
      const item = make('li', winners.has(row.month) ? 'question-highlight' : '');
      const label = make('abbr', '', name.slice(0, 3));
      label.title = name;
      item.append(label, make('strong', '', count(row.count)));
      labels.append(item);
    }
    body.append(axes, plot, labels, foot);
    return body;
  }

  function distanceChart(distances) {
    const {body, foot} = figure('Distribution of straight-line distances', 'Distance bands start at the lower bound and stop before the upper bound.');
    if (!distances.length) {
      body.append(make('p', 'question-empty', 'No distances for these settings.'), foot);
      return body;
    }
    const width = 2;
    const extent = Math.floor(Math.max(...distances) / width) + 1;
    const buckets = Array.from({length: extent}, () => 0);
    for (const distance of distances) buckets[Math.floor(distance / width)] += 1;
    const top = Math.max(...buckets, 1);
    const list = make('ul', 'question-histogram');
    list.style.setProperty('--question-bins', String(buckets.length));

    for (const [index, total] of buckets.entries()) {
      const item = make('li', 'question-histogram-bin');
      const bar = make('span', 'question-histogram-bar');
      bar.style.setProperty('--bin-height', `${total / top * 100}%`);
      bar.setAttribute('aria-hidden', 'true');
      const track = make('div', 'question-histogram-track');
      track.append(bar);
      item.append(make('strong', '', count(total)), track, make('span', '', `${index * width}–${(index + 1) * width}`));
      list.append(item);
    }
    const axes = make('div', 'question-month-axes');
    axes.append(make('span', '', 'Number of sales'), make('span', '', 'Distance bands (miles)'));
    body.append(axes, list, foot);
    return body;
  }

  function question(container, index, title, description) {
    const section = make('section', 'graded-question');
    section.id = `q${index}`;
    section.setAttribute('aria-labelledby', `q${index}-title`);
    const titleNode = make('h3', 'graded-question-title', `Q${index}. ${title}`);
    titleNode.id = `q${index}-title`;
    const answer = make('p', 'question-answer');
    if (index >= 7) answer.setAttribute('aria-live', 'polite');
    const chart = make('div', 'question-chart');
    section.append(titleNode, make('p', 'question-definition', description), answer, chart);
    container.append(section);
    return {section, answer, chart};
  }

  function addField(form, questionId, key, label, config) {
    const field = make('div', 'question-field');
    const id = `${questionId}-${key}`;
    const labelNode = make('label', '', label);
    labelNode.htmlFor = id;
    const input = config.options ? make('select') : make('input');
    if (config.options) {
      for (const value of config.options) {
        const option = make('option', '', String(value));
        option.value = String(value);
        input.append(option);
      }
    } else {
      input.type = 'number';
      input.step = config.integer ? '1' : 'any';
      input.min = '0';
      input.required = true;
    }
    input.id = id;
    input.name = key;
    input.value = config.value;
    field.append(labelNode, input);
    form.append(field);
    return input;
  }

  function controls(section, fields, run) {
    const form = make('form', 'question-controls');
    const inputs = Object.entries(fields).map(([key, config]) =>
      ({key, config, input: addField(form, section.id, key, config.label, config)}));
    section.insertBefore(form, section.querySelector('.question-answer'));
    form.addEventListener('submit', event => event.preventDefault());

    let previousValues;
    const update = () => {
      const enteredValues = inputs.map(({input}) => input.value).join('\n');
      if (enteredValues === previousValues) return;
      previousValues = enteredValues;
      const params = {};
      for (const {key, config, input} of inputs) {
        const value = config.text ? input.value : Number(input.value);
        if (!input.value || (!config.text && (!Number.isFinite(value) || value < 0
            || (config.integer && !Number.isInteger(value))))) {
          run(null, `Enter a valid value for ${config.label.toLowerCase()}.`);
          return;
        }
        params[key] = value;
      }
      if (params.min > params.max) {
        run(null, 'The maximum must be at least the minimum price.');
        return;
      }
      run(params);
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();
  }

  function dynamic(q, result, data, fields, renderer) {
    controls(result.section, fields, (params, error) => {
      if (error) {
        result.answer.textContent = error;
        result.chart.replaceChildren();
        return;
      }
      const values = window.CampusData.dynamic(data, q, params);
      renderer(values, params, result);
    });
  }

  function mount(container, data, fixed) {
    const content = document.createDocumentFragment();

    const q1 = question(content, 1, 'Which city has the highest median sale price?', scope);
    const highestMedian = extremes(fixed.q1, 'median');
    q1.answer.textContent = `Highest median sale price: ${describe(highestMedian, 'city', 'median', money)}.`;
    q1.chart.append(barChart([...fixed.q1].sort(byValue('median')), {
      title: 'Median sale price by city (USD)', nameKey: 'city',
      series: singleSeries('median', money), leaders: highlighted(highestMedian, 'city'),
      note: 'The bars show the middle sale price among eligible transactions in each city.',
    }));

    const q2 = question(content, 2, 'Where is the mean sale price furthest above the median?', 'All sale rows. Gap = (mean − median) ÷ median.');
    const largestGap = extremes(fixed.q2, 'gap');
    q2.answer.textContent = `Largest gap: ${describe(largestGap, 'city', 'gap', percent)}.`;
    const cause = make('div', 'question-context');
    for (const city of largestGap) {
      const explanation = city.aboveCeiling
        ? `Removing the ${count(city.aboveCeiling)} sales above $5,000,000, including one at ${money(city.topPrice)}, reduces the mean to ${money(city.meanWithoutAboveCeiling)}.`
        : `The upper tail includes a ${money(city.topPrice)} sale, which has a greater influence on the mean than on the median.`;
      cause.append(make('p', '', `${city.city} has a mean of ${money(city.mean)} and a median of ${money(city.median)}. ${explanation}`));
    }
    q2.chart.append(cause, barChart([...fixed.q2].sort(byValue('gap')), {
      title: 'Mean and median sale prices by city (USD)', nameKey: 'city',
      series: [{key: 'mean', label: 'Mean', format: money}, {key: 'median', label: 'Median', format: money}],
      leaders: highlighted(largestGap, 'city'), detail: row => `Gap ${percent(row.gap)}`,
      note: 'Cities are ordered by the percentage gap. Both prices use every sale row.',
    }));

    const q3 = question(content, 3, 'How does the price rule change city rankings?', 'Rank each city by mean sale price with all rows and with the $10,000–$5,000,000 price scope.');
    const movers = fixed.q3.filter(row => row.change).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    q3.answer.textContent = `${count(movers.length)} of ${count(fixed.q3.length)} cities change rank.`;
    if (movers.length) {
      const list = make('ul', 'question-rank-moves');
      for (const row of movers) {
        const positions = Math.abs(row.change);
        list.append(make('li', '', `${row.city} ${row.change > 0 ? 'rises' : 'falls'} ${count(positions)} ${positions === 1 ? 'position' : 'positions'} from rank ${row.rawRank} to ${row.scopedRank}.`));
      }
      q3.chart.append(list);
    }
    q3.chart.append(rankChart(fixed.q3));

    const q4 = question(content, 4, 'How did campus area medians change from 2024 to 2025?', 'Compare the median sale prices by closing year. Change = (2025 median − 2024 median) ÷ 2024 median.');
    const increases = extremes(fixed.q4.filter(row => row.change > 0), 'change');
    const declines = fixed.q4.filter(row => row.change < 0).sort(byValue('change', false));
    const largestIncrease = increases.length ? describe(increases, 'campus', 'change', signedPercent) : 'None';
    const decreases = declines.length ? names.format(declines.map(row => `${row.campus} (${percent(row.change)})`)) : 'none';
    q4.answer.textContent = `Largest increase: ${largestIncrease}. Campus areas with decreases: ${decreases}.`;
    q4.chart.append(barChart([...fixed.q4].sort(byValue('change')), {
      title: 'Percent change in median sale price', nameKey: 'campus',
      series: singleSeries('change', signedPercent), leaders: highlighted(increases, 'campus'),
      detail: row => `2024 ${money(row.median2024)} · 2025 ${money(row.median2025)}`,
      note: 'Bars left of zero indicate a decline. Bars right of zero indicate an increase.',
    }));

    const q5 = question(content, 5, 'Which campus areas sell fastest and slowest?', 'Days on market = contract date minus list date. Both dates must be present.');
    const fast = extremes(fixed.q5, 'median', false);
    const slow = extremes(fixed.q5, 'median');
    q5.answer.textContent = `Fastest: ${describe(fast, 'campus', 'median', days)}. Slowest: ${describe(slow, 'campus', 'median', days)}.`;
    q5.chart.append(barChart([...fixed.q5].sort(byValue('median', false)), {
      title: 'Median days on market by campus area', nameKey: 'campus',
      series: singleSeries('median', days), leaders: highlighted([...fast, ...slow], 'campus'),
      detail: row => `${count(row.count)} sales used`,
      note: 'Medians use in-scope sales with both dates available. Same-day contracts can have zero days on market.',
    }));

    const q6 = question(content, 6, 'Where is the property-tax burden highest and lowest?', 'Annual property tax ÷ sale price, using sums over the same qualifying sales in each campus area.');
    const highTax = extremes(fixed.q6, 'burden');
    const lowTax = extremes(fixed.q6, 'burden', false);
    q6.answer.textContent = `Highest: ${describe(highTax, 'campus', 'burden', taxPercent)}. Lowest: ${describe(lowTax, 'campus', 'burden', taxPercent)}.`;
    q6.chart.append(barChart([...fixed.q6].sort(byValue('burden')), {
      title: 'Total annual property tax as a share of total sale price', nameKey: 'campus',
      series: singleSeries('burden', taxPercent), leaders: highlighted([...highTax, ...lowTax], 'campus'),
      detail: row => `${count(row.count)} sales used`,
      note: 'Uses sales within the price scope and annual taxes above zero and strictly below 10% of the sale price.',
    }));

    const q7 = question(content, 7, 'Which city is least expensive for a given bedroom count?', 'Compare median sale prices for homes with exactly the selected number of bedrooms.');
    dynamic(7, q7, data, {beds: {label: 'Bedrooms (exact count)', value: 3, integer: true}}, (rows, params, result) => {
      const least = extremes(rows, 'median', false);
      result.answer.textContent = least.length
        ? `Lowest median at ${count(params.beds)} bedrooms: ${describe(least, 'city', 'median', money)}.`
        : 'No eligible sales have this bedroom count.';
      result.chart.replaceChildren(barChart([...rows].sort(byValue('median', false)), {
        title: 'Median sale price by city (USD)', nameKey: 'city',
        series: singleSeries('median', money), leaders: highlighted(least, 'city'),
        detail: row => `${count(row.count)} sales`, note: scope,
      }));
    });

    const q8 = question(content, 8, 'Which city sells fastest in a selected price range?', 'Compare median days on market for sales in the entered range. Both price endpoints count.');
    dynamic(8, q8, data, {
      min: {label: 'Minimum price (USD)', value: 250000},
      max: {label: 'Maximum price (USD)', value: 500000},
    }, (rows, params, result) => {
      const fastest = extremes(rows, 'median', false);
      result.answer.textContent = fastest.length
        ? `Shortest median at ${money(params.min)}–${money(params.max)}: ${describe(fastest, 'city', 'median', days)}.`
        : 'No sales in this range have both listing and contract dates.';
      result.chart.replaceChildren(barChart([...rows].sort(byValue('median', false)), {
        title: 'Median days on market by city', nameKey: 'city',
        series: singleSeries('median', days), leaders: highlighted(fastest, 'city'),
        detail: row => `${count(row.count)} sales used`, note: `${scope} Both dates are required.`,
      }));
    });

    const q9 = question(content, 9, 'How many sales closed each month in a selected city?', 'Choose a city and closing year to see the recorded sales from January to December.');
    const defaultCity = data.cities.includes('Champaign, IL') ? 'Champaign, IL' : data.cities[0];
    dynamic(9, q9, data, {
      city: {label: 'City', value: defaultCity, options: data.cities, text: true},
      year: {label: 'Closing year', value: data.years.includes(2025) ? 2025 : data.years[0], options: data.years},
    }, (rows, params, result) => {
      const peak = extremes(rows.filter(row => row.count > 0), 'count');
      result.answer.textContent = peak.length
        ? `${params.city} in ${params.year}: ${names.format(peak.map(row => months[row.month - 1]))} had the most sales (${count(peak[0].count)}).`
        : `No recorded sales in ${params.city} in ${params.year}.`;
      result.chart.replaceChildren(monthlyChart(rows, highlighted(peak, 'month')));
    });

    const q10 = question(content, 10, 'How close to campus can a buyer get within a budget?', 'Choose a campus, maximum price, and minimum bedroom count. The budget cap includes sales at that price.');
    const defaultCampus = data.campuses.find(value => value.includes('Illinois')) ?? data.campuses[0];
    dynamic(10, q10, data, {
      campus: {label: 'Campus area', value: defaultCampus, options: data.campuses, text: true},
      max: {label: 'Maximum budget (USD)', value: 400000},
      beds: {label: 'Minimum bedrooms', value: 3, integer: true},
    }, (summary, params, result) => {
      result.answer.textContent = summary.count
        ? `${params.campus} has ${count(summary.count)} qualifying sales within ${money(params.max)} and with at least ${count(params.beds)} bedrooms. Median distance: ${miles(summary.median)}.`
        : 'No eligible sales meet these conditions.';
      result.chart.replaceChildren(distanceChart(summary.distances));
    });

    container.replaceChildren(content);
  }

  return {mount};
})();
