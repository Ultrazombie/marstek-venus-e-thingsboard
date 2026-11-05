var timer, lastTs, el, gradId;
var STALE_SEC = 180;

function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) {
        return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c];
    });
}

var GREEN = '#4caf50', ORANGE = '#ff9800', RED = '#f44336', BLUE = '#2196f3', GREY = '#90a4ae';

function state(kind, v) {
    if (kind === 'grid') {
        return v > 0 ? { color: RED, hint: 'Exporting to grid' } :
               v < 0 ? { color: GREEN, hint: 'Charging' } : { color: GREY, hint: 'Idle' };
    }
    if (kind === 'temp') {
        return v < 5 ? { color: BLUE, hint: 'Cold' } : v < 40 ? { color: GREEN, hint: 'Normal' } :
               v < 50 ? { color: ORANGE, hint: 'Warm' } : { color: RED, hint: 'Hot' };
    }
    return null;
}

function age() {
    if (!lastTs) { return; }
    var sec = Math.max(0, Math.round((Date.now() - lastTs) / 1000));
    var stale = sec > STALE_SEC;
    var node = el.querySelector('.mv-updated');
    el.querySelector('.mv-card').classList.toggle('stale', stale);
    if (stale) {
        node.textContent = 'no data for ' + Math.round(sec / 60) + ' min';
    } else if ((self.ctx.settings || {}).showAge) {
        node.textContent = 'updated ' + (sec < 60 ? sec + ' s' : Math.round(sec / 60) + ' min') + ' ago';
    } else {
        node.textContent = '';
    }
}

self.onInit = function() {
    var s = self.ctx.settings || {};
    gradId = 'mvg' + Math.random().toString(36).slice(2);
    el = self.ctx.$container[0].querySelector('.mv-root');
    el.innerHTML =
        '<div class="mv-card' + (s.gear ? ' has-gear' : '') + '" style="--accent:' + esc(s.color || '#2196f3') + '">' +
        '<div class="mv-icon"><span class="material-icons">' + esc(s.icon || 'bolt') + '</span></div>' +
        '<div class="mv-body">' +
        '<div class="mv-head"><span class="mv-label">' + esc(s.label) + '</span><span class="mv-updated"></span></div>' +
        '<div class="mv-main"><span class="mv-value">–</span><span class="mv-unit">' + esc(s.units) + '</span>' +
        '<span class="mv-hint">' + esc(s.hint) + '</span></div></div>' +
        (s.spark ? '<svg class="mv-spark" viewBox="0 0 100 30" preserveAspectRatio="none"></svg>' : '') +
        (s.gear ? '<button type="button" class="mv-gear" title="Settings"><span class="material-icons">settings</span></button>' : '') +
        '</div>';
    timer = setInterval(age, 15000);

    var gearButton = el.querySelector('.mv-gear');
    if (gearButton) {
        gearButton.addEventListener('click', function(event) {
            event.stopPropagation();
            var gears = self.ctx.actionsApi.getActionDescriptors('gearClick');
            if (!gears || !gears.length) { return; }
            var ds = self.ctx.datasources && self.ctx.datasources[0];
            var entityId = ds && ds.entityId ? { entityType: ds.entityType, id: ds.entityId } : null;
            self.ctx.actionsApi.handleWidgetAction(event, gears[0], entityId, ds && ds.entityName, null, ds && ds.entityLabel);
        });
    }

    var descriptors = self.ctx.actionsApi.getActionDescriptors('cardClick');
    if (descriptors && descriptors.length) {
        var card = el.querySelector('.mv-card');
        card.classList.add('clickable');
        card.title = descriptors[0].name || '';
        card.addEventListener('click', function(event) {
            var ds = self.ctx.datasources && self.ctx.datasources[0];
            var entityId = ds && ds.entityId ? { entityType: ds.entityType, id: ds.entityId } : null;
            self.ctx.actionsApi.handleWidgetAction(event, descriptors[0], entityId, ds && ds.entityName, null, ds && ds.entityLabel);
        });
    }
};

function spark(points, range) {
    var svg = el.querySelector('.mv-spark');
    var vals = [];
    var n = Math.min(points.length, 80);
    var size = points.length / n;
    for (var i = 0; i < n; i++) {
        var chunk = points.slice(Math.floor(i * size), Math.floor((i + 1) * size) || undefined);
        var sum = 0;
        chunk.forEach(function(p) { sum += p; });
        vals.push(sum / chunk.length);
    }
    if (vals.length < 2) { svg.innerHTML = ''; return; }
    var lo = range[0], span = range[1] - range[0];
    var xy = vals.map(function(v, i) {
        var y = 27 - Math.max(0, Math.min(1, (v - lo) / span)) * 24;
        return (i / (vals.length - 1) * 100).toFixed(2) + ',' + y.toFixed(2);
    });
    svg.innerHTML =
        '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/>' +
        '<stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>' +
        '<polygon points="0,30 ' + xy.join(' ') + ' 100,30" fill="url(#' + gradId + ')"/>' +
        '<polyline points="' + xy.join(' ') + '" fill="none" stroke="var(--accent)" stroke-width="1.6" ' +
        'vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>';
}

self.onDataUpdated = function() {
    var s = self.ctx.settings || {};
    var d = self.ctx.data && self.ctx.data[0] && self.ctx.data[0].data;
    if (!d || !d.length) { return; }
    var last = d[d.length - 1];
    var raw = last[1];
    var num = Number(raw);
    var isNum = raw !== '' && raw !== null && !isNaN(num);
    var card = el.querySelector('.mv-card');
    var shown = raw;
    if (isNum) {
        var v = s.divisor ? num / s.divisor : num;
        shown = s.decimals != null ? v.toFixed(s.decimals) : String(v);
        num = v;
        var st = state(s.kind, v);
        if (st) {
            el.querySelector('.mv-hint').textContent = st.hint;
            card.style.setProperty('--accent', st.color);
        }
    }
    el.querySelector('.mv-value').textContent = shown;
    if (isNum && s.spark) {
        var series = [];
        d.forEach(function(p) {
            var x = Number(p[1]);
            if (!isNaN(x)) { series.push(s.divisor ? x / s.divisor : x); }
        });
        spark(series, s.spark);
    }
    lastTs = last[0];
    age();
};

self.onDestroy = function() {
    clearInterval(timer);
};

self.typeParameters = function() {
    return { maxDatasources: 1, maxDataKeys: 1, dataKeysOptional: false };
};

self.actionSources = function() {
    return { cardClick: { name: 'Card click', multiple: true }, gearClick: { name: 'Gear button click', multiple: true } };
};
