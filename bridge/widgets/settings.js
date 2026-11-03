var root, el = {}, st = null, busy = false, pollTimer;

function setMsg(text, cls) {
    el.msg.textContent = text || '';
    el.msg.className = 'ms-msg ' + (cls || '');
}

function send(method, params, cb) {
    self.ctx.controlApi.sendTwoWayCommand(method, params, 30000).subscribe(
        function(res) { cb(null, res); },
        function(err) { cb(err && (err.statusText || err.message) || 'no response'); });
}

function loadState() {
    send('getState', {}, function(err, res) {
        if (err || !res || res.error) { return; }
        st = res;
        renderState();
    });
}

function run(method, params, label) {
    if (busy) { return; }
    busy = true;
    setMsg(label + ': sending…');
    send(method, params, function(err, res) {
        busy = false;
        var time = new Date().toLocaleTimeString();
        if (err) { setMsg(label + ': failed - ' + err, 'err'); }
        else if (res && res.error) { setMsg(label + ': ' + res.error, 'err'); }
        else if (res && res.set_result === false) { setMsg(label + ': the device rejected the command (' + time + ')', 'err'); }
        else { setMsg(label + ': done (' + time + ')', 'ok'); }
        loadState();
    });
}

function confirmThen(title, message, fn) {
    var dialogs = self.ctx.dialogs;
    if (dialogs && dialogs.confirm) {
        dialogs.confirm(title, message, 'Cancel', 'Confirm').subscribe(function(ok) { if (ok) { fn(); } });
    } else if (window.confirm(title + '\n\n' + message)) {
        fn();
    }
}

function help(text, right) {
    return '<span class="ms-help' + (right ? ' right' : '') + '" tabindex="0"><span class="material-icons">help_outline</span><span class="ms-tip">' + text + '</span></span>';
}

function lastSet(v, fmt) { return v == null ? 'not set from here yet' : 'last set from here: ' + fmt(v); }

function renderState() {
    var d = (st && st.device) || {};
    if (d.dod != null) { el.dod.value = d.dod; el.dodVal.textContent = d.dod + '%'; }
    root.querySelector('#ms-dod-hint').textContent = lastSet(d.dod, function(v) { return v + '%'; });
    root.querySelector('#ms-led-hint').textContent = lastSet(d.led, function(v) { return v ? 'on' : 'off'; });
    root.querySelector('#ms-ble-hint').textContent = lastSet(d.ble_adv, function(v) { return v ? 'on' : 'off'; });
    [['led', d.led], ['ble', d.ble_adv]].forEach(function(c) {
        root.querySelectorAll('#ms-' + c[0] + ' button').forEach(function(b) {
            b.classList.toggle('on', c[1] != null && (b.dataset.v === '1') === !!c[1]);
        });
    });
}

self.onInit = function() {
    root = self.ctx.$container[0].querySelector('.ms-root');
    root.innerHTML =
        '<div class="ms-panel"><div class="ms-grid">' +
        '<div class="ms-card"><b>Depth of discharge' + help('Lowest charge level the battery may reach, 30-88% (88 is the default). Lower values keep a reserve. Needs battery firmware 150 or newer. The battery cannot report this value, so the last value set from this dashboard is shown.') + '</b>' +
        '<span class="ms-hint" id="ms-dod-hint"></span><div class="ms-ctl"><input type="range" id="ms-dod" min="30" max="88" value="88">' +
        '<span class="ms-val" id="ms-dod-val">88%</span><button type="button" class="ms-btn" id="ms-dod-apply">Apply</button></div></div>' +
        '<div class="ms-card"><b>LED' + help('Status lights on the battery. Needs battery firmware 150 or newer. The battery cannot report this value, so the last value set from this dashboard is shown.') + '</b><span class="ms-hint" id="ms-led-hint"></span>' +
        '<div class="ms-ctl"><div class="ms-seg" id="ms-led"><button type="button" data-v="1">On</button><button type="button" data-v="0">Off</button></div></div></div>' +
        '<div class="ms-card"><b>Bluetooth' + help('Advertising lets the Marstek app find the battery. Needs battery firmware 150 or newer. The battery cannot report this value, so the last value set from this dashboard is shown.') + '</b><span class="ms-hint" id="ms-ble-hint"></span>' +
        '<div class="ms-ctl"><div class="ms-seg" id="ms-ble"><button type="button" data-v="1">On</button><button type="button" data-v="0">Off</button></div></div></div>' +
        '</div>' +
        '<div class="ms-msg"></div></div>';
    el = { msg: root.querySelector('.ms-msg'), dod: root.querySelector('#ms-dod'), dodVal: root.querySelector('#ms-dod-val') };
    el.dod.addEventListener('input', function() { el.dodVal.textContent = el.dod.value + '%'; });
    root.querySelector('#ms-dod-apply').addEventListener('click', function() {
        var v = Number(el.dod.value);
        confirmThen('Set depth of discharge to ' + v + '%?', 'The battery will stop discharging when the remaining charge reaches ' + (100 - v) + '%.',
            function() { run('setDod', { value: v }, 'Depth of discharge ' + v + '%'); });
    });
    [['led', 'setLed', 'LED'], ['ble', 'setBle', 'Bluetooth advertising']].forEach(function(c) {
        root.querySelectorAll('#ms-' + c[0] + ' button').forEach(function(b) {
            b.addEventListener('click', function() {
                var on = b.dataset.v === '1';
                confirmThen('Turn ' + c[2] + (on ? ' on?' : ' off?'),
                    !on && c[0] === 'ble' ? 'The Marstek app may not find the battery over Bluetooth until it is turned on again.' : 'The setting is sent to the battery.',
                    function() { run(c[1], { on: on }, c[2] + (on ? ' on' : ' off')); });
            });
        });
    });
    if (!self.ctx.defaultSubscription.rpcEnabled) { setMsg('Target device is not set', 'err'); return; }
    loadState();
    pollTimer = setInterval(loadState, 30000);
};

self.onDestroy = function() { clearInterval(pollTimer); };

self.typeParameters = function() {
    return { maxDatasources: 0, maxDataKeys: 0, dataKeysOptional: true, displayRpcMessageToast: false };
};
