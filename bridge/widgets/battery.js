var el, timer, lastTs;
var STALE_SEC = 180;
var GREEN = '#4caf50', ORANGE = '#ff9800', RED = '#f44336';
var RATE_WINDOW_MS = 3600000, RATE_MIN_SPAN_MS = 1800000, RATE_MIN_WH = 5;

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

function level(soc, reserve) {
    var floor = reserve === null ? 10 : reserve;
    if (soc <= floor) { return { color: RED, hint: reserve === null ? 'Very low' : 'At reserve' }; }
    if (soc <= floor + 10) { return { color: ORANGE, hint: 'Low' }; }
    return { color: GREEN, hint: soc >= 99 ? 'Full' : '' };
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

function runtimeText(stored, rated, reserve) {
    var rate = drainRate();
    if (rate === null || stored === null || reserve === null || !rated) { return ''; }
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

function render() {
    if (!el) { return; }
    var soc = lastValue('es_bat_soc');
    if (soc === null) { return; }
    var stored = lastValue('bat_bat_capacity'), rated = lastValue('bat_rated_capacity');
    var reserve = reservePercent();
    var state = level(soc, reserve);
    el.querySelector('.mb-card').style.setProperty('--accent', state.color);
    el.querySelector('.mb-value').textContent = Math.round(soc);
    el.querySelector('.mb-hint').textContent = state.hint;
    el.querySelector('.mb-empty').style.width = (100 - Math.max(0, Math.min(100, soc))) + '%';

    el.querySelector('.mb-reserve').textContent = reserve === null ? '' : 'Reserve ' + reserve + '%';

    var usable = '', energy = '';
    if (stored !== null) {
        energy = Math.round(stored) + (rated ? ' / ' + Math.round(rated) : '') + ' Wh';
        if (reserve !== null && rated) {
            usable = (Math.max(0, stored - reserve / 100 * rated) / 1000).toFixed(2) + ' kWh usable';
        }
    }
    el.querySelector('.mb-runtime').textContent = runtimeText(stored, rated, reserve);
    el.querySelector('.mb-usable').textContent = usable;
    el.querySelector('.mb-energy').textContent = (usable && energy ? ' · ' : '') + energy;

    var d = series('es_bat_soc');
    lastTs = d[d.length - 1][0];
    age();
}

self.onInit = function() {
    el = self.ctx.$container[0].querySelector('.mb-root');
    var image = (self.ctx.settings || {}).image;
    el.innerHTML =
        '<div class="mb-card" style="--accent:' + GREEN + '">' +
        (image ? '<img class="mb-img" alt="Battery" src="' + image + '">' : '') + '<div class="mb-body">' +
        '<div class="mb-head"><span class="mb-label">Battery</span><span class="mb-updated"></span></div>' +
        '<div class="mb-main"><span class="mb-value">–</span><span class="mb-unit">%</span><span class="mb-hint"></span><span class="mb-runtime"></span></div>' +
        '<div class="mb-track"><div class="mb-empty"></div></div>' +
        '<div class="mb-foot"><span><span class="mb-usable"></span><span class="mb-energy"></span></span>' +
        '<span class="mb-reserve"></span></div></div></div>';
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
    return { maxDatasources: 1, maxDataKeys: 3, dataKeysOptional: false, hasAdditionalLatestDataKeys: true };
};

self.actionSources = function() {
    return { cardClick: { name: 'Card click', multiple: true } };
};
