(() => {
  'use strict';

  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const floor = 10000;
  const ceiling = 5000000;
  const tableFields = ['city', 'count', 'median', 'dom'];
  const mapWidth = 600;
  const mapHeight = 325;

  function element(tag, className, label) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (label !== undefined) node.textContent = label;
    return node;
  }

  function option(value, label) {
    const node = element('option', '', label);
    node.value = value;
    return node;
  }

  function inRange(value, min, max) {
    return value !== null && value >= min && value <= max;
  }

  function closestValue(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function textNumber(value, formatter = number) {
    return value === null ? '—' : formatter.format(value);
  }

  function mount(container, data) {
    const observedDistances = data.scoped.map(row => row.miles).filter(Number.isFinite);
    const distanceBounds = {
      min: observedDistances.length ? Math.floor(Math.min(...observedDistances) * 10) / 10 : 0,
      max: observedDistances.length ? Math.ceil(Math.max(...observedDistances) * 10) / 10 : 20,
    };
    const defaults = {
      place: '', year: '', beds: '', priceMin: String(floor), priceMax: String(ceiling),
      distanceMin: String(distanceBounds.min), distanceMax: String(distanceBounds.max), basement: '',
      compareA: data.cities.includes('Champaign, IL') ? 'Champaign, IL' : data.cities[0],
      compareB: data.cities.includes('Urbana, IL') ? 'Urbana, IL' : data.cities[1],
      sort: 'count', direction: 'desc',
    };
    container.classList.add('campus-explorer');
    container.innerHTML = `
      <form class="explorer-filters" aria-label="Sale filters">
        <div class="explorer-fields">
          <div class="explorer-field"><label for="exp-place">Location</label><select id="exp-place" name="place"></select></div>
          <div class="explorer-field"><label for="exp-year">Sale year</label><select id="exp-year" name="year"></select></div>
          <div class="explorer-field"><label for="exp-beds">Bedrooms</label><select id="exp-beds" name="beds"></select></div>
          <div class="explorer-field"><label for="exp-basement">Basement</label><select id="exp-basement" name="basement"><option value="">Any</option><option value="1">Yes</option><option value="0">No</option><option value="unknown">Unknown</option></select></div>
          <fieldset class="explorer-bounds">
            <legend>Sale price (USD)</legend>
            <div class="explorer-bound-fields">
              <div class="explorer-field"><label for="exp-price-min">Minimum</label><input id="exp-price-min" name="priceMin" type="number" min="0" step="any" inputmode="decimal"></div>
              <div class="explorer-field"><label for="exp-price-max">Maximum</label><input id="exp-price-max" name="priceMax" type="number" min="0" step="any" inputmode="decimal"></div>
            </div>
          </fieldset>
          <fieldset class="explorer-bounds">
            <legend>Distance to campus (mi)</legend>
            <div class="explorer-bound-fields">
              <div class="explorer-field"><label for="exp-distance-min">Minimum</label><input id="exp-distance-min" name="distanceMin" type="number" step="0.1" inputmode="decimal"></div>
              <div class="explorer-field"><label for="exp-distance-max">Maximum</label><input id="exp-distance-max" name="distanceMax" type="number" step="0.1" inputmode="decimal"></div>
            </div>
            <div class="explorer-slider">
              <div class="explorer-slider-track" aria-hidden="true"></div>
              <input type="range" step="0.1" data-end="Min" aria-label="Minimum distance to campus in miles">
              <input type="range" step="0.1" data-end="Max" aria-label="Maximum distance to campus in miles">
            </div>
          </fieldset>
        </div>
        <div class="explorer-actions">
          <button class="explorer-button" type="button" data-action="reset">Reset filters</button>
          <button class="explorer-button explorer-share" type="button" data-action="share">Copy filter link</button>
          <p class="explorer-message" data-filter-message role="status"></p>
        </div>
      </form>
      <div class="explorer-kpis" aria-live="polite" aria-label="Filtered sales metrics">
        <div class="explorer-kpi"><span>Matching sales</span><strong data-metric="count"></strong></div>
        <div class="explorer-kpi"><span>Median sale price</span><strong data-metric="price"></strong></div>
        <div class="explorer-kpi"><span>Median days on market</span><strong data-metric="days"></strong></div>
      </div>
      <div class="explorer-visuals">
        <section class="explorer-panel explorer-map" aria-labelledby="exp-map-title">
          <h3 id="exp-map-title">City locations</h3>
          <p>Choose a city or open a group of nearby cities to filter the explorer.</p>
          <div class="explorer-map-surface">
            <canvas width="${mapWidth}" height="${mapHeight}" aria-hidden="true"></canvas>
            <div class="explorer-map-markers" aria-label="Map selections"></div>
          </div>
          <div class="explorer-map-choices" hidden></div>
          <p class="explorer-map-caption">City markers use median transaction coordinates. Boundaries from the U.S. Census Bureau, via <a href="https://github.com/topojson/us-atlas">U.S. Atlas</a>.</p>
        </section>
        <section class="explorer-panel" aria-labelledby="exp-chart-title">
          <h3 id="exp-chart-title">Median sale price by city</h3>
          <p data-bar-description></p>
          <div class="explorer-bars"></div>
        </section>
      </div>
      <section class="explorer-panel explorer-comparison" aria-labelledby="exp-comparison-title">
        <h3 id="exp-comparison-title">Compare two cities</h3>
        <p>Both cities use the same year, bedroom, price, distance and basement filters.</p>
        <div class="explorer-compare-grid">
          <div class="explorer-compare-card">
            <div class="explorer-field"><label for="exp-compare-a">First city</label><select id="exp-compare-a" name="compareA"></select></div>
            <dl class="explorer-compare-stats" data-compare-stats="compareA" aria-live="polite"></dl>
          </div>
          <div class="explorer-compare-card">
            <div class="explorer-field"><label for="exp-compare-b">Second city</label><select id="exp-compare-b" name="compareB"></select></div>
            <dl class="explorer-compare-stats" data-compare-stats="compareB" aria-live="polite"></dl>
          </div>
        </div>
      </section>
      <section class="explorer-panel explorer-results" aria-labelledby="exp-results-title">
        <h3 id="exp-results-title">Results by city</h3>
        <table class="explorer-table" aria-labelledby="exp-results-title">
          <thead><tr>
            <th scope="col"><button data-sort="city" type="button">City<span class="explorer-sort-icon" aria-hidden="true"></span></button></th>
            <th scope="col"><button data-sort="count" type="button">Sales<span class="explorer-sort-icon" aria-hidden="true"></span></button></th>
            <th scope="col"><button data-sort="median" type="button">Median price<span class="explorer-sort-icon" aria-hidden="true"></span></button></th>
            <th scope="col"><button data-sort="dom" type="button">Median days<span class="explorer-sort-icon" aria-hidden="true"></span></button></th>
          </tr></thead>
          <tbody></tbody>
        </table>
        <p class="explorer-empty" hidden>No sales match these filters. Try widening a range or selecting Any.</p>
      </section>`;

    const find = selector => container.querySelector(selector);
    const fields = {};
    for (const node of container.querySelectorAll('[name]')) fields[node.name] = node;
    fields.place.append(option('', 'All locations'));
    for (const [type, label, values] of [['city', 'Cities', data.cities], ['campus', 'Campus areas', data.campuses]]) {
      const group = element('optgroup');
      group.label = label;
      group.append(...values.map(value => option(`${type}:${value}`, value)));
      fields.place.append(group);
    }
    fields.year.append(option('', 'Any year'), ...data.years.map(year => option(year, year)));
    fields.beds.append(option('', 'Any number'), ...data.bedrooms.map(beds => option(beds, `${beds} bedrooms`)));
    for (const name of ['compareA', 'compareB']) fields[name].append(...data.cities.map(city => option(city, city)));

    const distanceTrack = find('.explorer-slider');
    const distanceSliders = {
      Min: find('[data-end="Min"]'),
      Max: find('[data-end="Max"]'),
    };
    for (const input of [fields.distanceMin, fields.distanceMax, distanceSliders.Min, distanceSliders.Max]) {
      input.min = distanceBounds.min;
      input.max = distanceBounds.max;
    }
    const map = setupMap(find('.explorer-map'), data.cityLocations, city => {
      fields.place.value = `city:${city}`;
      update();
    });
    const message = find('[data-filter-message]');
    let sortKey = defaults.sort;
    let sortDirection = defaults.direction;

    function syncDistanceSliders() {
      distanceSliders.Min.value = fields.distanceMin.value || defaults.distanceMin;
      distanceSliders.Max.value = fields.distanceMax.value || defaults.distanceMax;
      const percent = value => (value - distanceBounds.min) * 100 / (distanceBounds.max - distanceBounds.min || 1);
      distanceTrack.style.setProperty('--range-from', `${percent(Number(distanceSliders.Min.value))}%`);
      distanceTrack.style.setProperty('--range-to', `${percent(Number(distanceSliders.Max.value))}%`);
    }

    function populate(params) {
      for (const [name, field] of Object.entries(fields)) {
        const value = params.get(name) ?? defaults[name];
        field.value = value;
        if (field.value !== value && field.tagName === 'SELECT') field.value = defaults[name];
      }
      const sort = params.get('sort');
      sortKey = tableFields.includes(sort) ? sort : defaults.sort;
      sortDirection = params.get('direction') === 'asc' ? 'asc' : defaults.direction;
      syncDistanceSliders();
    }

    function saveAddress() {
      const address = new URL(window.location.href);
      const settings = Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.value]));
      settings.sort = sortKey;
      settings.direction = sortDirection;
      for (const [name, value] of Object.entries(settings)) {
        if (value === defaults[name]) address.searchParams.delete(name);
        else address.searchParams.set(name, value);
      }
      if (address.href !== window.location.href) window.history.replaceState(window.history.state, '', address);
    }

    function numericRange(from, to, bounds) {
      const min = fields[from].value === '' ? bounds.min : Number(fields[from].value);
      const max = fields[to].value === '' ? bounds.max : Number(fields[to].value);
      return { min, max };
    }

    function update(writeURL = true) {
      const price = numericRange('priceMin', 'priceMax', { min: floor, max: ceiling });
      const distance = numericRange('distanceMin', 'distanceMax', distanceBounds);
      const place = fields.place.value;
      const [placeType, ...placeParts] = place.split(':');
      const placeName = placeParts.join(':');
      const filterYear = fields.year.value;
      const filterBeds = fields.beds.value;
      const filterBasement = fields.basement.value;
      const useDistance = distance.min !== distanceBounds.min || distance.max !== distanceBounds.max;
      const validPrice = price.min <= price.max && price.min >= 0;
      const validDistance = distance.min <= distance.max && distance.min >= distanceBounds.min && distance.max <= distanceBounds.max;
      message.textContent = !validPrice ? 'Enter a valid price range with the minimum no greater than the maximum.'
        : !validDistance ? `Enter distance bounds between ${distanceBounds.min} and ${distanceBounds.max} miles in increasing order.` : '';

      const matchingAcrossCities = validPrice && validDistance ? data.scoped.filter(row =>
        (!filterYear || row.year === Number(filterYear)) &&
        (!filterBeds || row.beds === Number(filterBeds)) &&
        inRange(row.price, price.min, price.max) &&
        (!useDistance || inRange(row.miles, distance.min, distance.max)) &&
        (!filterBasement || row.basement === (filterBasement === 'unknown' ? null : Number(filterBasement)))
      ) : [];
      const matching = place ? matchingAcrossCities.filter(row => row[placeType] === placeName) : matchingAcrossCities;
      const groups = new Map();
      for (const row of matching) {
        if (!groups.has(row.city)) groups.set(row.city, []);
        groups.get(row.city).push(row);
      }
      const cities = Array.from(groups, ([city, rows]) => ({ city, ...summarize(rows) }));
      const totals = summarize(matching);
      find('[data-metric="count"]').textContent = number.format(totals.count);
      find('[data-metric="price"]').textContent = textNumber(totals.median, currency);
      find('[data-metric="days"]').textContent = textNumber(totals.dom);
      map.select(placeType === 'city' ? [placeName] : placeType === 'campus'
        ? Array.from(new Set(data.scoped.filter(row => row.campus === placeName).map(row => row.city))) : []);
      renderChart(cities);
      renderTable(cities);
      for (const name of ['compareA', 'compareB']) {
        const stats = summarize(matchingAcrossCities.filter(row => row.city === fields[name].value));
        find(`[data-compare-stats="${name}"]`).replaceChildren(
          element('dt', '', 'Median price'), element('dd', '', textNumber(stats.median, currency)),
          element('dt', '', 'Sales'), element('dd', '', number.format(stats.count)),
        );
      }
      syncDistanceSliders();
      if (writeURL) saveAddress();
    }

    function summarize(rows) {
      return {
        count: rows.length,
        median: window.CampusData.median(rows.map(row => row.price)),
        dom: window.CampusData.median(rows.map(row => row.dom).filter(Number.isFinite)),
      };
    }

    function renderChart(cities) {
      const chart = find('.explorer-bars');
      const description = find('[data-bar-description]');
      const leaders = [...cities].sort((a, b) => (b.median - a.median) || a.city.localeCompare(b.city)).slice(0, 6);
      description.textContent = leaders.length === 0 ? 'No matching cities.' : cities.length > 6
        ? 'Six highest medians in the current view. The table lists all matching cities.'
        : 'Matching cities ranked by median price.';
      const maximum = leaders[0]?.median ?? 1;
      chart.replaceChildren(...leaders.map(city => {
        const bar = element('div', 'explorer-bar');
        const track = element('div', 'explorer-bar-track');
        track.setAttribute('aria-hidden', 'true');
        const fill = element('div', 'explorer-bar-fill');
        fill.style.width = `${100 * city.median / maximum}%`;
        track.append(fill);
        bar.append(element('span', 'explorer-bar-label', city.city),
          element('span', 'explorer-bar-value', currency.format(city.median)), track);
        return bar;
      }));
    }

    function renderTable(cities) {
      const direction = sortDirection === 'asc' ? 1 : -1;
      const output = [...cities].sort((a, b) => {
        const left = a[sortKey];
        const right = b[sortKey];
        if (left === null && right !== null) return 1;
        if (left !== null && right === null) return -1;
        const order = sortKey === 'city' ? left.localeCompare(right) : (left - right);
        return direction * order || a.city.localeCompare(b.city);
      });
      for (const button of container.querySelectorAll('[data-sort]')) {
        if (sortKey === button.dataset.sort) button.parentElement.setAttribute('aria-sort', sortDirection === 'asc' ? 'ascending' : 'descending');
        else button.parentElement.removeAttribute('aria-sort');
      }
      find('.explorer-table tbody').replaceChildren(...output.map(city => {
        const row = element('tr');
        row.append(element('td', '', city.city), element('td', '', number.format(city.count)),
          element('td', '', textNumber(city.median, currency)), element('td', '', textNumber(city.dom)));
        return row;
      }));
      find('.explorer-empty').hidden = output.length !== 0;
    }

    for (const button of container.querySelectorAll('[data-sort]')) {
      button.addEventListener('click', () => {
        const key = button.dataset.sort;
        sortDirection = sortKey === key ? (sortDirection === 'asc' ? 'desc' : 'asc') : (key === 'city' ? 'asc' : 'desc');
        sortKey = key;
        update();
      });
    }
    for (const field of Object.values(fields)) field.addEventListener(field.tagName === 'SELECT' ? 'change' : 'input', () => update());
    for (const endpoint of ['Min', 'Max']) {
      distanceSliders[endpoint].addEventListener('input', () => {
        const slider = distanceSliders[endpoint];
        const value = Number(slider.value);
        const oppositeEnd = endpoint === 'Min' ? 'Max' : 'Min';
        const opposite = Number(distanceSliders[oppositeEnd].value);
        const min = endpoint === 'Min' ? distanceBounds.min : opposite;
        const max = endpoint === 'Max' ? distanceBounds.max : opposite;
        fields[`distance${endpoint}`].value = closestValue(value, min, max);
        update();
      });
    }
    find('form').addEventListener('submit', event => event.preventDefault());
    find('[data-action="reset"]').addEventListener('click', () => {
      populate(new URLSearchParams());
      update();
    });
    find('[data-action="share"]').addEventListener('click', async () => {
      const address = new URL(window.location.href);
      address.hash = 'explore';
      try {
        await window.navigator.clipboard.writeText(address.href);
        message.textContent = 'Filter link copied.';
      } catch {
        message.textContent = 'Copy this page’s address to share the filters.';
      }
    });
    window.addEventListener('popstate', () => {
      populate(new URLSearchParams(window.location.search));
      update(false);
    });
    populate(new URLSearchParams(window.location.search));
    update(false);
  }

  function mapPoint(lon, lat) {
    return { x: (lon + 126) * mapWidth / 60, y: (50.2 - lat) * mapHeight / 26.4 };
  }

  function setupMap(container, locations, onSelect) {
    const markers = container.querySelector('.explorer-map-markers');
    const choices = container.querySelector('.explorer-map-choices');
    const canvas = container.querySelector('canvas');
    const points = locations.map(location => ({ ...location, ...mapPoint(location.lon, location.lat) }));
    let selected = new Set();
    let expanded = '';

    function renderChoices(group) {
      choices.hidden = !group;
      choices.replaceChildren();
      if (!group) return;
      for (const point of group) {
        const button = element('button', 'explorer-button', point.city);
        button.type = 'button';
        button.setAttribute('aria-pressed', String(selected.has(point.city)));
        button.addEventListener('click', () => {
          onSelect(point.city);
          for (const next of choices.querySelectorAll('button')) {
            if (next.textContent === point.city) next.focus();
          }
        });
        choices.append(button);
      }
    }

    function drawMarkers() {
      const width = markers.clientWidth || mapWidth;
      const minimumDistance = 32 * mapWidth / width;
      const groups = [];
      for (const point of points) {
        const group = groups.find(items => items.some(other => Math.hypot(other.x - point.x, other.y - point.y) < minimumDistance));
        if (group) group.push(point);
        else groups.push([point]);
      }
      markers.replaceChildren();
      let currentGroup;
      for (const group of groups) {
        const clustered = group.length > 1;
        const key = group.map(point => point.city).join('|');
        const x = group.reduce((total, point) => total + point.x, 0) / group.length;
        const y = group.reduce((total, point) => total + point.y, 0) / group.length;
        const button = element('button', 'explorer-map-marker', clustered ? group.length : '');
        button.type = 'button';
        button.dataset.key = key;
        button.style.left = `${x * 100 / mapWidth}%`;
        button.style.top = `${y * 100 / mapHeight}%`;
        button.setAttribute('aria-label', clustered ? `Cities near ${group[0].city}: ${group.map(point => point.city).join(', ')}` : group[0].city);
        button.title = group.map(point => point.city).join(' · ');
        button.setAttribute('aria-pressed', String(group.some(point => selected.has(point.city))));
        if (clustered) button.setAttribute('aria-expanded', String(expanded === key));
        if (expanded === key) currentGroup = group;
        button.addEventListener('click', () => {
          if (clustered) {
            expanded = expanded === key ? '' : key;
            drawMarkers();
            if (expanded) choices.querySelector('button')?.focus();
          } else {
            expanded = '';
            onSelect(group[0].city);
          }
          if (!expanded) Array.from(markers.children).find(marker => marker.dataset.key === key)?.focus();
        });
        markers.append(button);
      }
      renderChoices(currentGroup);
    }

    const context = canvas.getContext('2d');
    if (context) drawBoundaries(context);
    if (window.ResizeObserver) new ResizeObserver(drawMarkers).observe(markers);
    return {
      select(cities) {
        selected = new Set(cities);
        drawMarkers();
      },
    };
  }

  // Simplified 2017 U.S. Census cartographic boundaries from U.S. Atlas states-10m.
  // The coordinates below use the same projection and canvas dimensions as mapPoint.
  const mainland = [446,240,447,251,454,266,454,272,460,288,459,301,456,307,458,304,453,311,456,308,449,308,447,302,443,300,441,293,439,292,439,286,437,289,433,280,433,279,436,275,433,273,434,276,433,278,431,275,431,271,432,273,433,266,432,259,429,259,426,253,420,247,409,252,410,253,413,252,410,254,406,253,406,249,397,244,380,246,382,245,380,240,379,245,367,244,361,249,363,250,365,248,366,250,368,249,366,253,363,253,365,256,370,259,366,262,367,259,362,257,358,260,356,257,354,257,351,260,347,257,349,258,344,252,341,252,342,251,338,252,340,253,337,254,325,252,313,256,315,255,312,254,312,251,310,253,311,257,308,260,313,257,297,268,289,276,286,285,288,297,286,291,286,281,289,274,296,268,292,268,291,272,288,272,290,273,288,275,285,275,287,277,286,282,284,282,286,282,286,290,289,298,286,300,269,293,266,285,265,279,257,270,252,258,246,252,237,250,233,252,231,258,227,261,215,253,211,241,196,227,178,227,178,232,149,232,112,218,113,215,89,217,85,208,79,203,76,203,75,199,69,198,64,194,54,193,54,186,41,171,40,168,42,166,41,163,36,160,35,153,40,157,36,151,37,149,35,149,35,152,30,150,30,147,23,138,21,128,16,120,19,108,14,91,19,77,20,49,25,49,19,48,19,44,20,47,22,43,19,43,19,41,21,40,19,39,18,40,13,23,20,25,29,25,31,27,32,25,34,28,28,35,31,35,29,35,35,28,35,36,33,35,33,38,32,35,31,36,33,38,37,35,36,31,38,27,36,24,36,26,35,25,36,23,33,21,36,20,35,18,33,18,32,15,308,15,308,10,310,10,314,18,322,21,330,19,334,20,333,21,335,22,336,24,339,23,344,27,351,24,352,26,365,27,351,33,339,42,341,43,351,40,352,41,350,44,353,43,356,45,380,33,383,34,378,37,375,42,379,40,377,41,382,41,386,46,391,46,408,42,411,42,410,46,419,45,419,49,418,50,421,52,424,51,425,53,413,51,413,54,405,51,397,52,394,57,393,56,395,53,390,56,390,54,384,64,382,65,380,70,390,60,383,78,381,86,382,91,382,97,386,105,394,102,398,92,395,81,397,68,405,61,403,66,405,64,405,67,406,61,411,59,409,57,410,55,412,54,425,60,427,64,425,64,427,68,427,72,421,77,421,80,424,81,426,77,431,75,434,78,436,89,435,93,433,95,434,93,432,93,425,104,435,109,443,107,469,94,471,91,469,85,476,84,490,85,498,82,497,78,499,78,496,76,497,74,510,64,545,64,547,60,551,61,557,53,557,49,560,43,568,34,571,37,578,35,582,39,582,56,586,57,585,61,588,62,590,66,587,69,586,68,584,71,582,70,578,72,578,73,576,73,575,71,574,76,572,72,572,70,570,71,569,77,558,80,554,85,552,90,552,92,554,93,551,94,550,97,553,98,553,101,556,104,560,104,558,100,560,101,560,107,560,105,556,105,551,108,553,107,553,104,548,108,548,106,547,108,548,105,546,104,545,109,531,110,524,113,522,116,537,111,539,113,541,112,528,118,521,119,520,117,517,119,520,120,519,128,511,139,510,139,511,136,505,132,505,129,504,132,509,140,509,145,501,161,500,159,503,151,501,151,501,146,499,147,497,146,497,143,500,143,497,142,498,139,496,140,497,138,498,138,497,136,500,131,497,134,496,133,496,135,494,135,496,138,494,141,497,150,490,145,487,145,489,142,488,142,487,146,490,145,490,148,498,152,496,155,491,151,497,156,497,159,496,158,497,159,495,159,497,162,491,160,493,160,495,164,500,163,505,177,500,168,502,174,498,171,499,173,495,173,497,174,494,175,493,171,493,176,499,175,500,179,501,175,502,175,503,179,499,183,495,183,494,181,495,180,494,181,494,182,490,181,495,184,492,188,490,187,497,187,495,191,493,191,495,191,500,186,495,192,490,191,484,194,480,201,473,202,466,212,455,218,455,220,452,220,453,221,448,228,447,234,445,237,446,240];
  const boundaries = [
    [378,187,404,187],
    [404,187,408,213,411,221,409,226,410,236],
    [410,236,384,236,386,243,385,245],
    [385,245,380,246,382,245,380,240,379,245,376,244],
    [376,244,375,225,378,187],
    [113,215,115,214,113,208,115,200,119,196,114,187],
    [114,187,112,174,118,175,119,162],
    [119,162,170,163],
    [170,163,170,232],
    [170,232,149,232,112,218,113,215],
    [170,113,219,113],
    [219,113,239,113,239,126],
    [239,126,240,163],
    [240,163,230,162],
    [230,162,170,163],
    [170,163,170,113],
    [410,236,411,240,438,242,438,244,441,238,446,240],
    [446,240,447,251,454,266,454,272,460,288,456,307,458,304,453,311,456,308,449,308,447,302,443,300,441,293,439,292,439,286,437,289,433,279,436,275,433,273,433,278,431,275,433,262,424,250,417,247,417,250,409,252,413,252,410,254,397,244,385,245],
    [404,187,417,187],
    [417,187,429,187],
    [429,187,427,191,431,194,434,200,445,212,449,223,451,224],
    [451,224,448,228,446,240],
    [385,105,392,104],
    [392,104,412,105],
    [412,105,412,137],
    [412,137,412,140,405,141,406,144,400,151,396,148,394,152,384,151,380,153],
    [380,153,380,147,385,141,384,136,385,105],
    [239,126,307,126],
    [307,126,311,127,309,131,314,136,314,163],
    [314,163,240,163],
    [553,88,550,84,549,60],
    [549,60,554,59,553,58,557,53,560,43,568,34,571,37,578,35,582,39,582,56,586,57,585,61,590,65,587,69,582,70,578,73,575,71,574,76,572,70,570,71,569,77,558,80,553,88],
    [527,92,535,92],
    [535,92,547,92,552,90],
    [552,90,554,93,550,97,553,98,556,104,560,103,559,100,561,105,551,108,553,107,553,104,549,107],
    [549,107,548,105],
    [548,105,548,105],
    [548,105,546,101,542,101],
    [542,101,525,100],
    [525,100,527,92],
    [288,15,308,15,308,10,310,10,314,18,322,21,330,19,336,24,339,23,344,27,351,24,365,27,351,33,340,43],
    [340,43,337,44,337,51,331,55,334,59,332,67,346,76,348,82],
    [348,82,295,82],
    [295,82,295,60,291,57,294,52],
    [294,52,288,15],
    [504,130,505,129],
    [505,129,506,128],
    [506,128,513,124,508,117,513,109],
    [513,109,521,113,520,117],
    [520,117,519,117],
    [519,117,517,119],
    [517,119,520,120,519,128,511,139,511,136,504,130],
    [504,130,504,130],
    [443,168,501,168],
    [501,168,505,177,500,168,502,174,498,171,499,173,495,173,497,174,494,175,493,171,493,175,499,175,500,179,502,175,503,179,499,183,495,183,495,180,494,182,490,181,495,184,490,187,497,187,493,191,500,186,495,192,490,191,484,194,480,201,475,201],
    [475,201,463,190,452,189,450,185,436,184,429,187],
    [417,187,421,181,440,173,443,168],
    [220,15,288,15],
    [294,52,220,52],
    [220,52,220,15],
    [314,163,314,169],
    [314,169,316,182,315,204],
    [315,204,308,200,296,203,291,200,289,203,288,200,280,201,279,198,275,199,268,197,266,194,263,195,260,193,260,169,230,169],
    [230,169,230,162],
    [455,101,462,98],
    [462,98,462,101,506,101,513,109],
    [506,128,502,129],
    [502,129,465,129],
    [465,129,455,129,455,118],
    [455,118,455,101],
    [219,64,220,52],
    [295,82,294,82,296,87,294,91,296,95],
    [296,95,288,91,280,92,275,89,219,89],
    [219,89,219,64],
    [315,204,320,205],
    [320,205,320,205],
    [320,205,320,212],
    [320,212,320,224,325,236,322,252],
    [322,252,313,256,315,255,312,254,312,251,311,252,311,257,308,260,313,257,290,274,286,284,288,297,286,291,286,281,289,274,296,268,288,272,290,273,288,275,285,275,287,277,286,282,284,282,286,282,286,290,289,298,286,300,269,293,265,279,257,270,252,258,246,252,237,250,233,252,231,258,227,261,215,253,211,241,195,227],
    [195,227,194,224,229,224,230,169],
    [219,89,219,113],
    [170,113,150,113,150,101],
    [150,101,150,70],
    [150,70,149,64,219,64],
    [542,101,541,109],
    [541,109,531,110,523,113],
    [523,113,525,111,525,100],
    [302,118,343,118,346,121],
    [346,121,346,129,353,135,354,139,359,140,356,148,365,154,365,159,369,163],
    [369,163,368,167,366,169],
    [366,169,365,169],
    [365,169,365,169],
    [365,169,363,175],
    [363,175,356,175,359,171,358,169,314,169],
    [307,126,302,118],
    [434,145,437,145,440,138,442,139,443,135,451,130,455,118],
    [465,129,465,135,472,130,475,132,478,129,482,130,483,134],
    [483,134,482,136,477,132,476,136,471,141,470,140,467,145,464,143,455,157,443,160,440,156],
    [440,156,435,151,434,145],
    [346,121,350,114,350,108,355,107,358,103,358,100,354,95],
    [354,95,382,95],
    [382,95,385,105],
    [380,153,379,157,375,158,375,162,370,160,369,163],
    [195,227,178,227,178,232,170,232],
    [363,175,361,181,358,182,359,185,357,187],
    [357,187,354,194,349,200,350,203,348,203,350,208,348,212],
    [348,212,320,212],
    [18,101,60,101],
    [60,101,60,101],
    [60,101,60,138,114,187],
    [113,215,89,217,85,208,76,203,75,199,54,193,54,186,41,171,41,163,36,160,35,153,40,157,36,151,37,149,35,149,35,152,30,150,30,147,23,138,21,128,16,120,19,113,18,101],
    [505,129,504,132,509,145],
    [509,145,503,145,502,129],
    [489,139,491,139,490,140],
    [490,140,489,139],
    [348,82,349,92,354,95],
    [302,118,301,108,296,95],
    [412,137,416,136,418,140,423,142,431,141,434,145],
    [440,156,429,166,423,167],
    [423,167,379,166,379,169,366,169],
    [365,169,365,169],
    [509,145,508,150],
    [508,150,503,151],
    [503,151,501,151,501,146,499,147,497,144,500,143,497,142,498,139,496,140,500,131,494,135,497,150,490,145,487,145,489,142],
    [489,142,490,140],
    [489,139,483,134],
    [392,104,398,94,395,81,397,68,405,61,405,67,406,61,411,59,409,57,412,54,425,60,427,64,425,64,427,72,421,77,421,80,424,81,426,77,431,75,434,78,436,89,435,93,432,93,425,104],
    [425,104,412,105],
    [356,45,382,34,375,42,379,40,377,41,382,41,386,46,392,46,411,42,410,46,419,45,418,50,425,52,413,51,413,54,405,51,397,52,394,57,395,53,390,56,390,54,384,63],
    [384,63,383,59,381,60],
    [381,60,381,60],
    [381,60,382,56,379,53,359,48,356,45],
    [356,45,356,45],
    [356,45,356,45],
    [357,187,378,187],
    [376,244,367,244,365,246],
    [365,246,361,241,362,236,344,236,345,228,351,220,349,218,348,212],
    [100,15,220,15],
    [150,70,146,67,145,70,137,69,132,72,129,67,125,66,122,57,114,57,117,44,112,43,102,34,103,31,100,27,100,15],
    [545,64,546,61,549,60],
    [553,88,552,90],
    [535,92,536,82,540,72,544,70,545,64],
    [462,98,471,91,469,85,492,85,498,82,497,78,499,78,496,76,497,74,507,66,512,64,527,64],
    [527,64,526,81,528,82,527,92],
    [523,113,522,116,537,111,541,112,528,118,521,119,520,117],
    [425,104,435,109,455,101],
    [25,49,31,51,32,56,37,57,70,52,91,52],
    [91,52,95,57,88,71,91,74,90,101],
    [90,101,60,101],
    [18,101,14,91,19,77,20,49,25,49],
    [423,167,443,168],
    [120,101,150,101],
    [119,162,120,101],
    [508,150,500,161,503,151],
    [489,142,487,146,490,145,498,152,496,155,491,151,497,156,497,159,495,159,497,162,491,160,495,164,500,163,501,168],
    [90,15,89,47,91,52],
    [25,49,19,48,19,44,20,47,22,43,19,41,21,40,18,40,13,22,31,27,32,25,34,28,28,35,31,35,29,35,35,28,35,36,33,35,33,38,31,36,33,38,37,35,36,31,38,27,33,21,36,20,32,15,90,15],
    [340,43,351,40,352,41,350,44,356,45],
    [384,63,380,69,390,60,383,78,381,86,382,95],
    [475,201,471,204,466,212,455,218,451,224],
    [90,15,100,15],
    [120,101,90,101],
    [527,64,545,64],
    [365,246,362,249,368,249,363,254,370,259,366,262,367,259,362,257,358,260,354,257,351,260,342,251,337,254,328,251,322,252],
    [548,105,546,104,545,109,541,109]
  ];

  function trace(context, coordinates) {
    context.moveTo(coordinates[0], coordinates[1]);
    for (let index = 2; index < coordinates.length; index += 2) {
      context.lineTo(coordinates[index], coordinates[index + 1]);
    }
  }

  function drawBoundaries(context) {
    context.beginPath();
    trace(context, mainland);
    context.closePath();
    context.fillStyle = 'rgba(67, 129, 122, 0.17)';
    context.fill();

    context.beginPath();
    for (const boundary of boundaries) trace(context, boundary);
    context.strokeStyle = 'rgba(67, 129, 122, 0.65)';
    context.lineWidth = 1.05;
    context.stroke();
  }

  window.CampusExplorer = { mount };
})();
