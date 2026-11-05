import json
import os
import urllib.parse
import uuid

TITLE = "Marstek Venus E"
VERSION = "50"
COLS = 24
def realtime_window(ms):
    return {"displayValue": "", "selectedTab": 0,
            "realtime": {"realtimeType": 0, "interval": 60000, "timewindowMs": ms},
            "aggregation": {"type": "NONE", "limit": 5000}}


TW_MAIN = realtime_window(6 * 3600 * 1000)
TW_DAY = realtime_window(24 * 3600 * 1000)
TW_DAILY_BARS = {"displayValue": "", "selectedTab": 0,
                 "realtime": {"realtimeType": 0, "interval": 24 * 3600 * 1000, "timewindowMs": 14 * 24 * 3600 * 1000},
                 "aggregation": {"type": "MAX", "limit": 1000}}
TW_MONTH = {"selectedTab": 1,
            "history": {"historyType": 0, "interval": 7200000, "timewindowMs": 30 * 24 * 3600 * 1000},
            "aggregation": {"type": "MAX", "limit": 1000}}
POPUP_WINDOW = {"grid_input_month": TW_MONTH, "battery_output_month": TW_MONTH}
POPUP_ROWS = 16
ROW_SCALE = 1
CARD_ROWS = 1
SETTINGS_ROWS = 5
GRID = {"backgroundColor": "#eeeeee", "columns": COLS, "margin": 10, "outerMargin": True,
        "backgroundSizeMode": "100%"}

BLUE, GREEN, ORANGE, RED, GREY = "#2196f3", "#4caf50", "#ff9800", "#f44336", "#607d8b"

CHART_ROWS = 4
LEFT_COLS = 16
# Optional device whose telemetry key is above 0 while mains power is present; adds a timeline strip.
GRID_DEVICE = os.environ.get("TB_GRID_DEVICE")
GRID_KEY = os.environ.get("TB_GRID_KEY", "power")

# label, key, units, decimals, icon, color, divisor, kind, sparkline range, (row, col, width)
CARDS = [
    ("Mode", "es_mode", "", None, "tune", BLUE, None, "mode", None, (0, 12, 6)),
    ("Grid power", "es_ongrid_power", "W", 0, "bolt", GREEN, None, "grid", None, (0, 18, 6)),
    ("Temperature", "bat_bat_temp", "°C", 1, "thermostat", GREEN, None, "temp", (0, 60), (1, 12, 6)),
    ("Off-grid power", "es_offgrid_power", "W", 0, "power", BLUE, None, None, None, (1, 18, 6)),
]

# Same fields; rows are relative to the first row below the status cards.
ENERGY_CARDS = [
    ("Grid input today", "grid_input_day", "kWh", 2, "today", BLUE, 1000, None, None, (6, LEFT_COLS, 4)),
    ("Battery output today", "battery_output_day", "kWh", 2, "today", ORANGE, 1000, None, None, (6, LEFT_COLS + 4, 4)),
    ("Grid input month", "grid_input_month", "kWh", 2, "calendar_month", BLUE, 1000, None, None, (7, LEFT_COLS, 4)),
    ("Battery output month", "battery_output_month", "kWh", 2, "calendar_month", ORANGE, 1000, None, None, (7, LEFT_COLS + 4, 4)),
]

TEMP = "#ff7043"
STATE_NAMES = {"default": TITLE, "controls": "Battery control"}

# key -> title, icon, units, decimals, colour, divisor, threshold lines (value, colour)
CHART_SPECS = {
    "es_bat_soc": ("Battery charge", "battery_full", "%", 0, GREEN, None, []),
    "es_ongrid_power": ("Grid power", "bolt", "W", 0, ORANGE, None, [(0, GREY)]),
    "es_offgrid_power": ("Off-grid power", "power", "W", 0, BLUE, None, []),
    "bat_bat_temp": ("Battery temperature", "thermostat", "°C", 1, TEMP, None, [(40, ORANGE), (50, RED)]),
    "bat_bat_capacity": ("Stored energy", "battery_charging_full", "Wh", 0, BLUE, None, []),
    "grid_input_day": ("Grid input today", "today", "kWh", 2, BLUE, 1000, []),
    "grid_input_month": ("Grid input month", "calendar_month", "kWh", 2, BLUE, 1000, []),
    "battery_output_day": ("Battery output today", "today", "kWh", 2, ORANGE, 1000, []),
    "battery_output_month": ("Battery output month", "calendar_month", "kWh", 2, ORANGE, 1000, []),
}
Y_RANGE = {"es_bat_soc": (0, 100), "bat_bat_temp": (0, 60)}

WIDGETS_DIR = os.path.join(os.path.dirname(__file__), "widgets")
CUSTOM = {"status_card": "Marstek status card", "battery": "Marstek battery card", "flow": "Marstek energy flow",
          "grid_status": "Marstek mains timeline", "controls": "Marstek controls",
          "settings": "Marstek battery settings"}
CUSTOM_TYPE = {"status_card": "timeseries", "battery": "timeseries", "flow": "timeseries", "grid_status": "timeseries",
               "controls": "rpc", "settings": "rpc"}
CUSTOM_SIZE = {"status_card": (6, 1), "battery": (12, 2), "flow": (8, 3), "grid_status": (24, 1),
               "controls": (24, 8), "settings": (24, 5)}


def read(name, ext):
    with open(os.path.join(WIDGETS_DIR, name + "." + ext)) as f:
        return f.read()


def widget_body(name, namespace="marstek"):
    title = CUSTOM[name]
    sx, sy = CUSTOM_SIZE[name]
    descriptor = {
        "type": CUSTOM_TYPE[name], "sizeX": sx, "sizeY": sy, "resources": [],
        "templateHtml": read(name, "html"), "templateCss": read(name, "css"),
        "controllerScript": read(name, "js"),
        "settingsSchema": "{}", "dataKeySettingsSchema": "{}", "settingsDirective": "",
        "defaultConfig": json.dumps({
            "datasources": [], "showTitle": False, "backgroundColor": "rgba(0, 0, 0, 0)",
            "color": "rgba(0, 0, 0, 0.87)", "padding": "0px", "margin": "0px", "settings": {},
            "title": title, "dropShadow": False, "enableFullscreen": False, "widgetStyle": {},
            "actions": {}, "showLegend": False, "targetDevice": None}),
    }
    return {"fqn": namespace + "." + name, "name": title, "descriptor": descriptor}


def upsert_widgets(http, jwt):
    existing = {t["fqn"]: t for t in http("GET", "/api/widgetTypes?pageSize=1000&page=0&tenantOnly=true",
                                          token=jwt)["data"]}
    fqns = {}
    for name in CUSTOM:
        body = widget_body(name)
        if body["fqn"] in existing:
            body["id"] = existing[body["fqn"]]["id"]
        saved = http("POST", "/api/widgetType", body, token=jwt)
        fqns[name] = "tenant." + saved["fqn"]
    return fqns


def default_configs(http, jwt, fqns):
    types = http("GET", "/api/widgetTypes?pageSize=1000&page=0", token=jwt)["data"]
    ids = {t["fqn"]: t["id"]["id"] for t in types}
    out = {}
    for fqn in fqns:
        d = http("GET", "/api/widgetType/" + ids[fqn], token=jwt)["descriptor"]
        out[fqn] = (d["type"], json.loads(d["defaultConfig"]))
    return out


def datasource(alias_id, keys):
    return [{"type": "entity", "entityAliasId": alias_id, "dataKeys": [
        {"name": n, "type": "timeseries", "label": label, "color": color, "settings": {}}
        for n, label, color in keys]}]


def clone(x):
    return json.loads(json.dumps(x))


def axis_limit(value):
    return {"type": "constant", "value": value, "entityAlias": None}


def add_reserve_line(cfg, units, decimals, y_axis="default"):
    """Draw the backup reserve (100 - depth of discharge) from the last DOD known to ThingsBoard."""
    cfg["datasources"][0]["latestDataKeys"] = [
        {"name": "dod", "type": "attribute", "label": "Backup reserve", "color": RED, "settings": {},
         "usePostProcessing": True, "postFuncBody": "return 100 - value;"}]
    cfg["settings"]["thresholds"] = cfg["settings"]["thresholds"] + [
        {"type": "latestKey", "latestKey": "dod", "latestKeyType": "attribute", "yAxisId": y_axis,
         "units": units, "decimals": decimals, "lineColor": RED, "lineType": "dashed", "lineWidth": 1,
         "startSymbol": "none", "endSymbol": "none", "showLabel": True, "labelPosition": "end", "labelColor": RED}]


# The battery reports output as positive; charts show charging going up and discharging going down.
BATTERY_VIEW_KEYS = {"es_ongrid_power", "es_offgrid_power"}


def series_key(key, y_axis="default", fill=True, legend=False):
    title, _, units, decimals, color, div, _ = CHART_SPECS[key]
    area = {"type": "gradient", "opacity": 0.15, "gradient": {"start": 55, "end": 0}} if fill else {"type": "none"}
    data_key = {"name": key, "type": "timeseries", "label": title, "color": color,
                "units": units, "decimals": decimals,
                "settings": {"yAxisId": y_axis, "showInLegend": legend, "dataHiddenByDefault": False,
                             "type": "line",
                             "lineSettings": {"showLine": True, "step": False, "smooth": True, "lineWidth": 2,
                                              "showPoints": False, "showPointLabel": False,
                                              "fillAreaSettings": area}}}
    if div:
        data_key.update(usePostProcessing=True, postFuncBody="return value / %d;" % div)
    if key in BATTERY_VIEW_KEYS:
        data_key.update(usePostProcessing=True, postFuncBody="return value ? -value : 0;")
    return data_key


def chart_config(base, alias_id, key, popup=False):
    title, icon, units, decimals, color, div, thresholds = CHART_SPECS[key]
    data_key = series_key(key)
    cfg = clone(base)
    cfg["datasources"] = [{"type": "entity", "entityAliasId": alias_id, "dataKeys": [data_key]}]
    cfg.update(title=title, showTitle=True, showTitleIcon=True, titleIcon=icon, iconColor=color,
               useDashboardTimewindow=True, units=units, decimals=decimals, dropShadow=False,
               borderRadius="14px", enableFullscreen=False, enableDataExport=False)
    cfg["settings"].update(showLegend=False, dataZoom=popup, stack=False)
    if popup:
        cfg.update(useDashboardTimewindow=False, timewindow=POPUP_WINDOW.get(key, TW_DAY))
    cfg["settings"]["yAxes"]["default"].update(units=units, decimals=decimals)
    if key in Y_RANGE:
        # a bare 0 is treated as "not set" by the chart, so pass limits as value sources
        cfg["settings"]["yAxes"]["default"].update(min=axis_limit(Y_RANGE[key][0]), max=axis_limit(Y_RANGE[key][1]))
    cfg["settings"]["thresholds"] = [
        {"type": "constant", "value": v, "yAxisId": "default", "units": units, "decimals": decimals,
         "lineColor": c, "lineType": "dashed", "lineWidth": 1, "startSymbol": "none", "endSymbol": "none",
         "showLabel": True, "labelPosition": "end", "labelColor": c} for v, c in thresholds]
    if key == "es_bat_soc":
        add_reserve_line(cfg, units, decimals)
    return cfg


def power_chart_config(base, alias_id):
    cfg = chart_config(base, alias_id, "es_ongrid_power")
    cfg["datasources"][0]["dataKeys"] = [
        series_key("es_ongrid_power", fill=False, legend=True),
        series_key("es_offgrid_power", fill=False, legend=True)]
    cfg.update(title="Power (+ charge / − discharge)", titleIcon="bolt", iconColor=ORANGE, showLegend=True)
    cfg["settings"]["showLegend"] = True
    cfg["settings"]["legendConfig"].update(position="top", direction="row", showMin=False, showMax=False,
                                           showAvg=False, showTotal=False, showLatest=False)
    for threshold in cfg["settings"]["thresholds"]:
        threshold["showLabel"] = False
    return cfg


def energy_chart_config(base, alias_id):
    """Daily energy from the battery's lifetime counters: each bar is the rise since the previous day."""
    cfg = chart_config(base, alias_id, "grid_input_month")
    post = "return prevOrigValue ? Math.max(0, value - prevOrigValue) / 1000 : 0;"
    cfg["datasources"][0]["dataKeys"] = [
        {"name": key, "type": "timeseries", "label": label, "color": color, "units": "kWh", "decimals": 2,
         "usePostProcessing": True, "postFuncBody": post,
         "settings": {"yAxisId": "default", "showInLegend": True, "dataHiddenByDefault": False, "type": "bar"}}
        for key, label, color in (("es_total_grid_input_energy", "Charged from grid", GREEN),
                                  ("es_total_load_energy", "Battery output", ORANGE))]
    cfg.update(title="Energy per day", titleIcon="bar_chart", iconColor=GREEN, showLegend=True,
               useDashboardTimewindow=False, timewindow=TW_DAILY_BARS)
    cfg["settings"]["showLegend"] = True
    cfg["settings"]["legendConfig"].update(position="top", direction="row", showMin=False, showMax=False,
                                           showAvg=False, showTotal=False, showLatest=False)
    return cfg


def build(configs, custom, alias_id, grid_alias=None):
    widgets, layouts = {}, {"default": {}, "settings": {}, "controls": {}}
    for key in CHART_SPECS:
        layouts["chart_" + key] = {}

    def add(fqn, wtype, config, w, h, row, col, state="default"):
        if state == "default":
            h, row = int(round(h * ROW_SCALE)), int(round(row * ROW_SCALE))
        wid = str(uuid.uuid4())
        widgets[wid] = {"id": wid, "typeFullFqn": fqn, "type": wtype,
                        "sizeX": w, "sizeY": h, "row": row, "col": col, "config": config}
        layouts[state][wid] = {"sizeX": w, "sizeY": h, "row": row, "col": col}

    def custom_cfg():
        return {"datasources": [], "showTitle": False, "backgroundColor": "rgba(0, 0, 0, 0)",
                "color": "rgba(0, 0, 0, 0.87)", "padding": "0px", "margin": "0px", "settings": {},
                "dropShadow": False, "enableFullscreen": False, "widgetStyle": {}, "actions": {},
                "showLegend": False, "enableDataExport": False}

    base = configs["time_series_chart"][1]
    for key in CHART_SPECS:
        add("system.time_series_chart", "timeseries", chart_config(base, alias_id, key, popup=True),
            COLS, POPUP_ROWS, 0, 0, state="chart_" + key)

    cfg = custom_cfg()
    cfg["datasources"] = [{"type": "entity", "entityAliasId": alias_id, "dataKeys": [
        {"name": n, "type": "timeseries", "label": n, "color": GREEN, "settings": {}}
        for n in ("es_bat_soc", "bat_bat_capacity", "bat_rated_capacity")],
        "latestDataKeys": [{"name": "dod", "type": "attribute", "label": "dod", "color": RED, "settings": {}}]}]
    cfg["actions"] = {"cardClick": [{
        "id": str(uuid.uuid4()), "name": "Show chart", "icon": "show_chart",
        "type": "openDashboardState", "targetDashboardStateId": "chart_es_bat_soc",
        "openRightLayout": False, "setEntityId": False, "stateEntityParamName": None,
        "openInSeparateDialog": True, "dialogTitle": CHART_SPECS["es_bat_soc"][0],
        "dialogHideDashboardToolbar": True}]}
    add(custom["battery"], "timeseries", cfg, 12, 2, 0, 0)

    top = 2
    if grid_alias:
        cfg = custom_cfg()
        cfg["datasources"] = datasource(grid_alias, [(GRID_KEY, "Mains power", GREEN)])
        add(custom["grid_status"], "timeseries", cfg, COLS, 1, top, 0)
        top += 1

    placed = [(card, 0) for card in CARDS] + [(card, top) for card in ENERGY_CARDS]
    for (label, key, units, decimals, icon, color, div, kind, spark, (row, col, w)), offset in placed:
        row += offset
        cfg = custom_cfg()
        cfg["datasources"] = datasource(alias_id, [(key, label, color)])
        cfg["settings"] = {"label": label, "units": units, "decimals": decimals, "icon": icon,
                           "color": color, "divisor": div, "kind": kind, "spark": spark}
        if kind == "mode":
            cfg["settings"].update(gear=True, showAge=True, hint="Controls ›")
            cfg["actions"] = {"gearClick": [{
                "id": str(uuid.uuid4()), "name": "Battery settings", "icon": "settings",
                "type": "openDashboardState", "targetDashboardStateId": "settings",
                "openRightLayout": False, "setEntityId": False, "stateEntityParamName": None,
                "openInSeparateDialog": True, "dialogTitle": "Battery settings",
                "dialogHideDashboardToolbar": True, "dialogWidth": 70, "dialogHeight": 38}],
                "cardClick": [{
                    "id": str(uuid.uuid4()), "name": "Open battery control", "icon": "tune",
                    "type": "openDashboardState", "targetDashboardStateId": "controls",
                    "openRightLayout": False, "setEntityId": False, "stateEntityParamName": None}]}
        if key in CHART_SPECS:
            title = CHART_SPECS[key][0]
            cfg["actions"] = {"cardClick": [{
                "id": str(uuid.uuid4()), "name": "Show chart", "icon": "show_chart",
                "type": "openDashboardState", "targetDashboardStateId": "chart_" + key,
                "openRightLayout": False, "setEntityId": False, "stateEntityParamName": None,
                "openInSeparateDialog": True, "dialogTitle": title,
                "dialogHideDashboardToolbar": True}]}
        add(custom["status_card"], "timeseries", cfg, w, CARD_ROWS, row, col)

    add("system.time_series_chart", "timeseries", chart_config(base, alias_id, "es_bat_soc"),
        LEFT_COLS, CHART_ROWS, top, 0)
    add("system.time_series_chart", "timeseries", power_chart_config(base, alias_id),
        LEFT_COLS, CHART_ROWS, top + CHART_ROWS, 0)

    cfg = custom_cfg()
    cfg["datasources"] = datasource(alias_id, [(n, n, BLUE) for n in ("es_ongrid_power", "es_offgrid_power", "es_bat_soc")])
    add(custom["flow"], "timeseries", cfg, COLS - LEFT_COLS, 3, top, LEFT_COLS)
    add("system.time_series_chart", "timeseries", energy_chart_config(base, alias_id),
        COLS - LEFT_COLS, 3, top + 3, LEFT_COLS)

    cfg = custom_cfg()
    cfg["targetDevice"] = {"type": "entity", "entityAliasId": alias_id}
    cfg["targetDeviceAliasIds"] = [alias_id]
    cfg["settings"] = {"maxPower": 2500}
    add(custom["controls"], "rpc", cfg, COLS, 8, 0, 0, state="controls")

    cfg = custom_cfg()
    cfg["targetDevice"] = {"type": "entity", "entityAliasId": alias_id}
    cfg["targetDeviceAliasIds"] = [alias_id]
    add(custom["settings"], "rpc", cfg, COLS, SETTINGS_ROWS, 0, 0, state="settings")
    return widgets, layouts


def dashboard_config(configs, custom, device_name):
    alias_id = str(uuid.uuid4())
    grid_alias = str(uuid.uuid4()) if GRID_DEVICE else None
    widgets, layouts = build(configs, custom, alias_id, grid_alias)
    aliases = {alias_id: {"id": alias_id, "alias": device_name, "filter": {
        "type": "entityName", "resolveMultiple": False, "entityType": "DEVICE", "entityNameFilter": device_name}}}
    if grid_alias:
        aliases[grid_alias] = {"id": grid_alias, "alias": GRID_DEVICE, "filter": {
            "type": "entityName", "resolveMultiple": False, "entityType": "DEVICE", "entityNameFilter": GRID_DEVICE}}
    return {
        "description": "v" + VERSION,
        "widgets": widgets,
        "states": {name: {"name": STATE_NAMES.get(name, name), "root": name == "default",
                          "layouts": {"main": {"widgets": layout,
                                    "gridSettings": dict(GRID, autoFillHeight=name == "default")}}}
                   for name, layout in layouts.items()},
        "entityAliases": aliases,
        "timewindow": TW_MAIN,
        "settings": {"stateControllerId": "entity", "showTitle": False, "showDashboardsSelect": False,
                     "showEntitiesSelect": False, "showFilters": False, "showDashboardTimewindow": True,
                     "showDashboardExport": True, "toolbarAlwaysOpen": True},
        "filters": {},
    }


def ensure(http, jwt, device_id, device_name):
    custom = upsert_widgets(http, jwt)
    found = http("GET", "/api/tenant/dashboards?pageSize=10&page=0&textSearch=" + urllib.parse.quote(TITLE),
                 token=jwt)["data"]
    for d in found:
        if d["title"] != TITLE:
            continue
        cur = http("GET", "/api/dashboard/" + d["id"]["id"], token=jwt)
        if (cur.get("configuration") or {}).get("description") == "v" + VERSION:
            return "exists"
        http("DELETE", "/api/dashboard/" + d["id"]["id"], token=jwt)

    configs = default_configs(http, jwt, ["time_series_chart"])
    config = dashboard_config(configs, custom, device_name)
    d = http("POST", "/api/dashboard", {"title": TITLE, "configuration": config}, token=jwt)
    return "created " + d["id"]["id"]
