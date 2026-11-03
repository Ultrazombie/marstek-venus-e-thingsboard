## Solution Description

Monitor and control a Marstek Venus E home battery from ThingsBoard. A small bridge polls the battery over its local Open API and sends charge level, power, temperature and energy counters to a ready-made dashboard with live trends, daily and monthly grid input, a temperature alarm, and confirmed charge-only controls.

### Highlights

- Compact status cards with live sparklines: battery charge, mode, grid and off-grid power, temperature, capacity, grid input today and this month.
- Click any card to open a detailed trend chart with zoom and a selectable time window.
- Temperature chart with warning thresholds, plus a built-in alarm for a hot battery.
- Mode panel that shows the active mode and what the battery is doing, with one tile per mode: Auto, AI, Manual, Passive and UPS.
- Charge or discharge at a chosen power for a chosen time, and a weekly Manual schedule of up to 10 windows that you edit in a list and apply to the battery in one step; ThingsBoard remembers the applied windows.
- Battery settings behind the gear on the Mode card: depth of discharge, LED and Bluetooth advertising.
- Every command asks for confirmation before anything is sent to the battery.

### What is included

- A dashboard with two custom widgets: a status card with sparkline and a control panel.
- A device profile with a high battery temperature alarm.
- A demo device with simulated data, so the dashboard is populated right after installation.

### Safety by design

Discharging into the grid is switched off by default. Modes that can export energy (Auto and AI) are locked and discharge options are hidden until you turn on "Allow discharge to grid" on the dashboard. The bridge enforces the setting, so it cannot be bypassed from the UI.

### Requirements

- Marstek Venus E with Open API enabled in the Marstek app, reachable from the machine running the bridge.
- A host with Docker on the same local network as the battery.
