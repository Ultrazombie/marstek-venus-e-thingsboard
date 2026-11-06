# Marstek Venus E solution template (draft)

Draft package for ThingsBoard IoT Hub. Not published anywhere.

## Build

```
cd solution-template
NICKNAME=<creator nickname> python3 -I build.py
```

The build reads the default configuration of the system chart widget from `system_widgets/time_series_chart.json`, a copy of `application/src/main/data/json/system/widget_types/time_series_chart.json` from ThingsBoard 4.4.0.2; refresh that copy when targeting a newer ThingsBoard, or set `TB_URL` (with `TB_USER`/`TB_PASSWORD` or `TB_API_KEY`) to fetch it from a running instance instead. Output: `marstek-venus-e-1.0.0.zip` (the template) and `widgets/*.json` (one file per custom widget, for separate Widget uploads).

## Contents

- `content/` description and instructions shown on the listing and after install
- `images/` preview and gallery screenshots, taken from the live dashboard (`preview.png`, `gallery-*.png`)
- `../bridge/` bridge source (`bridge.py`, `dashboard.py`, `widgets/`); the dashboard and widgets in the package are generated from it

## Open items before publishing

- Creator nickname: widget fqn must be `nickname.widget_fqn` (currently `marstek`)
- Publish the custom widgets first: `marstek.status_card`, `marstek.battery`, `marstek.flow`, `marstek.grid_status`, `marstek.controls`, `marstek.settings`
- Ask `iothub@thingsboard.io`: is a Solution Template that needs an external bridge allowed, and how to stop the emulator once a real device is connected
- Minimum ThingsBoard version (tested on 4.4.0.2)
- The controls widget resizes its own `gridster-item` to fit its content; mention it to reviewers, it relies on ThingsBoard internals
- Writing DOD, windows and the Auto/AI modes to a real battery is untested; LED and Bluetooth were exercised by hand
