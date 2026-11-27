(() => {
  'use strict';

  const PRICE_MIN = 10000;
  const PRICE_MAX = 5000000;
  const DAY_MS = 86400000;
  const CSV_PATH = 'data/college_town_home_sales.csv';

  function readCsv(text, visit) {
    const source = text.replace(/^\uFEFF/, '');
    let row = [];
    let start = 0;
    let quoted = false;
    for (let index = 0; index <= source.length; index += 1) {
      const char = source[index];
      if (char === '"') {
        if (quoted && source[index + 1] === '"') {
          index += 1;
        } else if (quoted || index === start) {
          quoted = !quoted;
        }
      }
      if (quoted || (char !== ',' && char !== '\n' && char !== '\r' && char !== undefined)) {
        continue;
      }

      const field = source.slice(start, index);
      row.push(field.startsWith('"') ? field.slice(1, -1).replace(/""/g, '"') : field);
      if (char !== ',') {
        if (row.length > 1 || row[0] !== '') visit(row);
        row = [];
        if (char === '\r' && source[index + 1] === '\n') index += 1;
      }
      start = index + 1;
    }
    if (quoted) throw new Error('The sales CSV contains an unclosed quoted field.');
  }

  function numberOrNull(value) {
    if (value == null || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function dateMilliseconds(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00Z`);
    const milliseconds = date.getTime();
    return Number.isFinite(milliseconds) && date.toISOString().slice(0, 10) === value
      ? milliseconds : null;
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    const length = sorted.length;
    if (!length) return null;
    return (sorted[Math.floor((length - 1) / 2)] + sorted[Math.floor(length / 2)]) / 2;
  }

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function mean(values) {
    const finite = values.filter(Number.isFinite);
    return finite.length ? sum(finite) / finite.length : null;
  }

  function groupBy(rows, key) {
    const groups = new Map();
    for (const row of rows) {
      const label = row[key];
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(row);
    }
    return groups;
  }

  function valuesOf(rows, key) {
    return rows.map(row => row[key]).filter(Number.isFinite);
  }

  async function load() {
    const response = await fetch(CSV_PATH);
    if (!response.ok) throw new Error(`Unable to load the sales CSV (${response.status}).`);

    const rows = [];
    const ids = new Set();
    let header;
    let columns;
    const numericFields = {
      price: 'sale_price', beds: 'beds', area: 'living_area_sqft', built: 'year_built',
      basement: 'has_basement', garage: 'has_garage', fireplace: 'has_fireplace',
      lat: 'latitude', lon: 'longitude', miles: 'miles_to_campus', tax: 'tax_annual_amount',
    };
    const sourceFields = [
      'listing_id', 'city', 'state', 'university', 'sale_date', 'list_date', 'contract_date',
      ...Object.values(numericFields),
    ];

    readCsv(await response.text(), fields => {
      if (!header) {
        header = fields;
        columns = new Map(header.map((name, index) => [name, index]));
        if (sourceFields.some(name => !columns.has(name))) {
          throw new Error('The sales CSV is missing expected columns.');
        }
        return;
      }
      if (fields.length !== header.length) throw new Error('The sales CSV contains a malformed row.');

      const field = name => fields[columns.get(name)];
      const id = field('listing_id');
      if (!id || ids.has(id)) throw new Error('The sales CSV contains a missing or duplicate listing ID.');
      ids.add(id);

      const saleDate = field('sale_date');
      const saleTime = dateMilliseconds(saleDate);
      const listTime = dateMilliseconds(field('list_date'));
      const contractTime = dateMilliseconds(field('contract_date'));
      const row = {
        id,
        city: `${field('city')}, ${field('state')}`,
        campus: field('university'),
        year: saleTime === null ? null : Number(saleDate.slice(0, 4)),
        month: saleTime === null ? null : Number(saleDate.slice(5, 7)),
        dom: listTime === null || contractTime === null ? null : (contractTime - listTime) / DAY_MS,
      };
      for (const [key, name] of Object.entries(numericFields)) {
        row[key] = numberOrNull(field(name));
      }
      rows.push(row);
    });
    if (!rows.length) throw new Error('The sales CSV has no data rows.');

    const scoped = rows.filter(row => row.price >= PRICE_MIN && row.price <= PRICE_MAX);
    const cityGroups = groupBy(rows, 'city');
    const alphabetical = (a, b) => a.localeCompare(b, 'en-US');
    const cities = [...cityGroups.keys()].sort(alphabetical);
    const campuses = [...new Set(rows.map(row => row.campus))].sort(alphabetical);
    const years = [...new Set(valuesOf(rows, 'year'))].sort((a, b) => b - a);
    const bedrooms = [...new Set(valuesOf(rows, 'beds'))].sort((a, b) => a - b);
    const cityLocations = cities.map(city => ({
      city,
      lat: median(valuesOf(cityGroups.get(city), 'lat')),
      lon: median(valuesOf(cityGroups.get(city), 'lon')),
    }));
    return {rows, scoped, cities, campuses, years, bedrooms, cityLocations};
  }

  function medianBy(rows, key, labels, metric) {
    const groups = groupBy(rows, key);
    return labels.map(label => {
      const values = valuesOf(groups.get(label) ?? [], metric);
      return {[key]: label, median: median(values), count: values.length};
    });
  }

  function cityMeans(groups) {
    const cities = [...groups].map(([city, rows]) => ({city, mean: mean(valuesOf(rows, 'price'))}));
    const sorted = cities.filter(city => city.mean !== null).sort((a, b) => b.mean - a.mean);
    let rank;
    return new Map(sorted.map((city, index) => {
      if (index === 0 || city.mean !== sorted[index - 1].mean) rank = index + 1;
      return [city.city, {mean: city.mean, rank}];
    }));
  }

  function fixed(data) {
    const {rows, scoped, cities, campuses} = data;
    const rawCities = groupBy(rows, 'city');
    const scopedCities = groupBy(scoped, 'city');
    const campusSales = groupBy(scoped, 'campus');

    const q1 = medianBy(scoped, 'city', cities, 'price');
    const q2 = cities.map(city => {
      const prices = valuesOf(rawCities.get(city), 'price');
      const average = mean(prices);
      const middle = median(prices);
      const belowCeiling = prices.filter(price => price <= PRICE_MAX);
      return {
        city, mean: average, median: middle, count: prices.length,
        gap: middle === null || middle === 0 ? null : (average - middle) / middle,
        aboveCeiling: prices.length - belowCeiling.length,
        topPrice: prices.length ? Math.max(...prices) : null,
        meanWithoutAboveCeiling: mean(belowCeiling),
      };
    });
    const rawMeans = cityMeans(rawCities);
    const scopedMeans = cityMeans(scopedCities);
    const q3 = cities.map(city => {
      const raw = rawMeans.get(city);
      const valid = scopedMeans.get(city);
      return {
        city, rawMean: raw?.mean ?? null, scopedMean: valid?.mean ?? null,
        rawRank: raw?.rank ?? null, scopedRank: valid?.rank ?? null,
        change: raw && valid ? raw.rank - valid.rank : null,
      };
    });
    const q4 = campuses.map(campus => {
      const sales = campusSales.get(campus) ?? [];
      const median2024 = median(valuesOf(sales.filter(row => row.year === 2024), 'price'));
      const median2025 = median(valuesOf(sales.filter(row => row.year === 2025), 'price'));
      return {
        campus, median2024, median2025,
        change: median2024 === null || median2025 === null ? null : (median2025 - median2024) / median2024,
      };
    });
    const q5 = medianBy(scoped, 'campus', campuses, 'dom');
    const q6 = campuses.map(campus => {
      const valid = (campusSales.get(campus) ?? []).filter(row => row.tax > 0 && row.tax < row.price / 10);
      const taxTotal = sum(valuesOf(valid, 'tax'));
      const priceTotal = sum(valuesOf(valid, 'price'));
      return {campus, burden: priceTotal ? taxTotal / priceTotal : null, count: valid.length, taxTotal, priceTotal};
    });
    return {q1, q2, q3, q4, q5, q6};
  }

  function dynamic(data, question, params) {
    if (question === 7) {
      const beds = numberOrNull(params.beds);
      const rows = data.scoped.filter(row => beds !== null && row.beds === beds);
      return medianBy(rows, 'city', data.cities, 'price');
    }
    if (question === 8) {
      const min = numberOrNull(params.min);
      const max = numberOrNull(params.max);
      const rows = data.scoped.filter(row => min !== null && max !== null && row.price >= min && row.price <= max);
      return medianBy(rows, 'city', data.cities, 'dom');
    }
    if (question === 9) {
      const year = numberOrNull(params.year);
      const counts = Array(12).fill(0);
      for (const row of data.rows) {
        if (year !== null && row.city === params.city && row.year === year && row.month !== null) {
          counts[row.month - 1] += 1;
        }
      }
      return counts.map((count, index) => ({month: index + 1, count}));
    }
    if (question === 10) {
      const max = numberOrNull(params.max);
      const beds = numberOrNull(params.beds);
      const rows = data.scoped.filter(row => max !== null && beds !== null && row.campus === params.campus
        && row.price <= max && row.beds !== null && row.beds >= beds);
      const distances = valuesOf(rows, 'miles');
      return {median: median(distances), count: rows.length, distances};
    }
    throw new RangeError(`Unsupported dynamic question: ${question}`);
  }

  window.CampusData = Object.freeze({load, median, mean, fixed, dynamic, PRICE_MIN, PRICE_MAX});
})();
