var el, timer, lastTs, gradId;
var STALE_SEC = 180;
var GREEN = '#4caf50', ORANGE = '#ff9800', RED = '#f44336';

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

function age() {
    if (!lastTs) { return; }
    var sec = Math.max(0, Math.round((Date.now() - lastTs) / 1000));
    var stale = sec > STALE_SEC;
    el.querySelector('.mb-card').classList.toggle('stale', stale);
    el.querySelector('.mb-updated').textContent = stale ? 'no data for ' + Math.round(sec / 60) + ' min' : '';
}

function spark(top) {
    var svg = el.querySelector('.mb-spark');
    var points = series('bat_bat_capacity').map(function(p) { return Number(p[1]); }).filter(function(v) { return !isNaN(v); });
    if (points.length < 2 || !top) { svg.innerHTML = ''; return; }
    var n = Math.min(points.length, 80), size = points.length / n, vals = [];
    for (var i = 0; i < n; i++) {
        var chunk = points.slice(Math.floor(i * size), Math.floor((i + 1) * size) || undefined);
        vals.push(chunk.reduce(function(a, b) { return a + b; }, 0) / chunk.length);
    }
    var xy = vals.map(function(v, i) {
        return (i / (vals.length - 1) * 100).toFixed(2) + ',' + (28 - Math.min(1, v / top) * 26).toFixed(2);
    });
    svg.innerHTML =
        '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/>' +
        '<stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>' +
        '<polygon points="0,30 ' + xy.join(' ') + ' 100,30" fill="url(#' + gradId + ')"/>' +
        '<polyline points="' + xy.join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="1.6" ' +
        'vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>';
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
    el.querySelector('.mb-fill').style.width = Math.max(0, Math.min(100, soc)) + '%';

    var marker = el.querySelector('.mb-marker');
    marker.style.display = reserve === null ? 'none' : 'block';
    if (reserve !== null) { marker.style.left = reserve + '%'; }
    el.querySelector('.mb-reserve').textContent = reserve === null ? '' : 'Reserve ' + reserve + '%';

    var usable = '', energy = '';
    if (stored !== null) {
        energy = Math.round(stored) + (rated ? ' / ' + Math.round(rated) : '') + ' Wh';
        if (reserve !== null && rated) {
            usable = (Math.max(0, stored - reserve / 100 * rated) / 1000).toFixed(2) + ' kWh usable';
        }
    }
    el.querySelector('.mb-usable').textContent = usable;
    el.querySelector('.mb-energy').textContent = (usable && energy ? ' · ' : '') + energy;
    spark(rated || stored);

    var d = series('es_bat_soc');
    lastTs = d[d.length - 1][0];
    age();
}

self.onInit = function() {
    gradId = 'mbg' + Math.random().toString(36).slice(2);
    el = self.ctx.$container[0].querySelector('.mb-root');
    el.innerHTML =
        '<div class="mb-card" style="--accent:' + GREEN + '">' +
        '<div class="mb-head"><span class="mb-label">Battery</span><span class="mb-updated"></span></div>' +
        '<div class="mb-main"><span class="mb-value">–</span><span class="mb-unit">%</span><span class="mb-hint"></span></div>' +
        '<svg class="mb-spark" viewBox="0 0 100 30" preserveAspectRatio="none"></svg>' +
        '<div class="mb-track"><div class="mb-fill"></div><div class="mb-marker"></div></div>' +
        '<div class="mb-foot"><span><span class="mb-usable"></span><span class="mb-energy"></span></span>' +
        '<span class="mb-reserve"></span></div></div>';
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
