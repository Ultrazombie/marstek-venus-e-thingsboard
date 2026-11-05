var el, timer, lastTs;
var STALE_SEC = 180;
var RATE_WINDOW_MS = 3600000, RATE_MIN_SPAN_MS = 1800000, RATE_MIN_WH = 5;
var LOAD_WINDOW_MS = 600000, FLOW_MIN_W = 2;

function series(name) {
    var row = (self.ctx.data || []).filter(function(d) { return d.dataKey && d.dataKey.name === name; })[0];
    return row && row.data ? row.data : [];
}

function lastValue(name) {
    var d = series(name);
    var v = d.length ? Number(d[d.length - 1][1]) : NaN;
    return isNaN(v) ? null : v;
}

function reservePercent() {
    var row = (self.ctx.latestData || []).filter(function(d) { return d.dataKey && d.dataKey.name === 'dod'; })[0];
    var dod = row && row.data && row.data[0] ? Number(row.data[0][1]) : NaN;
    return dod > 0 && dod <= 100 ? 100 - dod : null;
}

function hint(soc, reserve) {
    var floor = reserve === null ? 10 : reserve;
    return soc <= floor ? (reserve === null ? 'Very low' : 'At reserve') : soc <= floor + 10 ? 'Low' : '';
}

// Wh per hour over the last hour of stored energy; positive means the battery is draining.
function drainRate() {
    var d = series('bat_bat_capacity');
    if (d.length < 2) { return null; }
    var end = d[d.length - 1], start = null;
    for (var i = d.length - 1; i >= 0 && end[0] - d[i][0] <= RATE_WINDOW_MS; i--) { start = d[i]; }
    if (!start || end[0] - start[0] < RATE_MIN_SPAN_MS) { return null; }
    return (Number(start[1]) - Number(end[1])) / ((end[0] - start[0]) / 3600000);
}

// Average output to the sockets over the last minutes: reacts to a new load right away.
function recentLoad() {
    var d = series('es_offgrid_power');
    if (!d.length) { return 0; }
    var end = d[d.length - 1][0], sum = 0, n = 0;
    for (var i = d.length - 1; i >= 0 && end - d[i][0] <= LOAD_WINDOW_MS; i--) { sum += Math.max(0, Number(d[i][1]) || 0); n++; }
    return n ? sum / n : 0;
}

function runtimeText(stored, rated, reserve) {
    if (stored === null || reserve === null || !rated) { return ''; }
    var load = recentLoad(), rate = load > FLOW_MIN_W ? load : drainRate();
    if (rate === null) { return ''; }
    if (rate <= -RATE_MIN_WH) { return 'Charging'; }
    if (rate < RATE_MIN_WH) { return ''; }
    var hours = Math.max(0, stored - reserve / 100 * rated) / rate;
    if (hours <= 0) { return ''; }
    var span = hours < 1 ? Math.round(hours * 60) + ' min' : hours < 72 ? Math.round(hours) + ' h' : Math.round(hours / 24) + ' days';
    return '≈ ' + span + ' to reserve';
}

function age() {
    if (!lastTs) { return; }
    var sec = Math.max(0, Math.round((Date.now() - lastTs) / 1000));
    var stale = sec > STALE_SEC;
    el.querySelector('.mb-card').classList.toggle('stale', stale);
    el.querySelector('.mb-updated').textContent = stale ? 'no data for ' + Math.round(sec / 60) + ' min' : '';
}

function setMood(card) {
    var grid = lastValue('es_ongrid_power') || 0, off = lastValue('es_offgrid_power') || 0;
    var mood = grid < -FLOW_MIN_W ? 'charging' : (grid > FLOW_MIN_W || off > FLOW_MIN_W) ? 'discharging' : 'idle';
    ['charging', 'discharging', 'idle'].forEach(function(m) { card.classList.toggle(m, m === mood); });
}

function render() {
    if (!el) { return; }
    var soc = lastValue('es_bat_soc');
    if (soc === null) { return; }
    var card = el.querySelector('.mb-card');
    var stored = lastValue('bat_bat_capacity'), rated = lastValue('bat_rated_capacity');
    var reserve = reservePercent();
    setMood(card);
    card.style.setProperty('--accent', reserve !== null && soc <= reserve ? '#D9694F' : '#6EE7A0');
    el.querySelector('.mb-value').textContent = Math.round(soc);
    el.querySelector('.mb-hint').textContent = hint(soc, reserve);
    el.querySelector('.mb-fill').style.width = Math.max(0, Math.min(100, soc)) + '%';

    var marker = el.querySelector('.mb-marker');
    marker.style.display = reserve === null ? 'none' : 'block';
    if (reserve !== null) { marker.style.left = reserve + '%'; }
    el.querySelector('.mb-reserve').textContent = reserve === null ? '' : 'Reserve ' + reserve + '%';

    var usable = '';
    if (stored !== null) {
        usable = reserve !== null && rated ?
            (Math.max(0, stored - reserve / 100 * rated) / 1000).toFixed(2) + ' kWh usable' : (stored / 1000).toFixed(2) + ' kWh stored';
    }
    el.querySelector('.mb-foot-value').textContent = usable;
    el.querySelector('.mb-runtime').textContent = runtimeText(stored, rated, reserve);

    var d = series('es_bat_soc');
    lastTs = d[d.length - 1][0];
    age();
}

self.onInit = function() {
    el = self.ctx.$container[0].querySelector('.mb-root');
    var image = (self.ctx.settings || {}).image;
    el.innerHTML =
        '<div class="mb-card idle">' +
        '<div class="mb-head"><span class="mb-label">Battery</span><span class="mb-updated"></span></div>' +
        '<div class="mb-main"><span class="mb-value">–</span><span class="mb-unit">%</span><span class="mb-hint"></span></div>' +
        '<div class="mb-runtime"></div>' +
        '<div class="mb-track"><div class="mb-fill"></div><div class="mb-marker"></div></div>' +
        '<div class="mb-foot"><span class="mb-foot-value"></span><span class="mb-reserve"></span></div>' +
        '<div class="mb-stage"><div class="mb-glow"></div>' +
        (image ? '<img class="mb-img" alt="Battery" src="' + image + '">' : '') + '</div></div>';
    timer = setInterval(age, 15000);

    var descriptors = self.ctx.actionsApi.getActionDescriptors('cardClick');
    if (descriptors && descriptors.length) {
        var card = el.querySelector('.mb-card');
        card.classList.add('clickable');
        card.title = descriptors[0].name || '';
        card.addEventListener('click', function(event) {
            var ds = self.ctx.datasources && self.ctx.datasources[0];
            var entityId = ds && ds.entityId ? { entityType: ds.entityType, id: ds.entityId } : null;
            self.ctx.actionsApi.handleWidgetAction(event, descriptors[0], entityId, ds && ds.entityName, null, ds && ds.entityLabel);
        });
    }
    render();
};

self.onDataUpdated = render;
self.onLatestDataUpdated = render;

self.onDestroy = function() {
    clearInterval(timer);
};

self.typeParameters = function() {
    return { maxDatasources: 1, maxDataKeys: 5, dataKeysOptional: false, hasAdditionalLatestDataKeys: true };
};

self.actionSources = function() {
    return { cardClick: { name: 'Card click', multiple: true } };
};
