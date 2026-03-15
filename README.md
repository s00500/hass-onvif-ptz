# ONVIF PTZ

[![GitHub Release][releases-shield]][releases]
[![GitHub Activity][commits-shield]][commits]

[![hacs][hacsbadge]][hacs]

_Integration to integrate with ONVIF cameras that support pan/tilt/zoom controls_

This integration is intended to extend the existing core ONVIF integration with
the ability to correctly call various camera's PTZ commands.

**This integration will set up the following platforms.**

Platform | Description
-- | --
`button` | Each camera profile which supports PTZ will create a fake button entity which supports PTZ commands.

Services | Description
-- | --
ptz_relative | ONVIF RelativeMove command, moves the camera relative to the current position
ptz_absolute | ONVIF AbsoluteMove command, moves the camera to a specified position
ptz_continuous | ONVIF ContinuousMove command, moves the camera at a specified velocity
ptz_stop | Stops camera movement
ptz_set_home_position | Sets the home position
ptz_goto_home_position | Goes to the home position
ptz_set_preset | Saves the current camera position as a preset (creates new if no token provided, updates existing if token provided)
ptz_get_presets | Returns a list of all saved presets with their tokens and names (response service)
ptz_goto_preset | Moves the camera to a saved preset position
ptz_remove_preset | Deletes a saved preset from the camera

## Installation

1. Using the tool of choice open the directory (folder) for your HA configuration (where you find `configuration.yaml`).
1. If you do not have a `custom_components` directory (folder) there, you need to create it.
1. In the `custom_components` directory (folder) create a new folder called `onvif_ptz`.
1. Download _all_ the files from the `custom_components/onvif_ptz/` directory (folder) in this repository.
1. Place the files you downloaded in the new directory (folder) you created.
1. Restart Home Assistant
1. In the HA UI go to "Configuration" -> "Integrations" click "+" and search for "ONVIF PTZ"

## Configuration is done in the UI

## Lovelace Preset Card

This integration includes a bundled Lovelace card for managing PTZ presets with a visual UI.

### Card Setup

1. Go to **Settings -> Dashboards -> Resources**
2. Add a new resource with URL: `/onvif_ptz/onvif-ptz-preset-card.js` and type **JavaScript Module**
3. Add the card to a dashboard — it will appear in the card picker as **ONVIF PTZ Presets**

### Card Configuration

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `entity` | Yes | — | A `button` entity from this integration (e.g. `button.camera_main_ptz_controls`) |
| `title` | No | `PTZ Presets` | Card header text |

Example YAML:

```yaml
type: custom:onvif-ptz-preset-card
entity: button.camera_main_ptz_controls
title: Camera Presets
```

### Normal Mode

Displays a grid of preset buttons. Tap a preset to move the camera to that position. Use the refresh button to reload presets from the camera and the pencil icon to enter edit mode.

### Edit Mode

Each preset shows a row with:

- **Rename** — Enter a new name and click Rename. The card moves the camera to the preset position first (since ONVIF `SetPreset` always saves the current position), waits for it to arrive, then saves with the new name.
- **Save Pos** — Overwrites the preset's saved position with where the camera is currently pointed.
- **Delete** — Removes the preset after confirmation.

At the bottom, an **Add** row lets you create a new preset at the camera's current position with an optional name.

<!---->

## Contributions are welcome!

If you want to contribute to this please read the [Contribution guidelines](CONTRIBUTING.md)

***

[onvif_ptz]: https://github.com/rbtying/hass-onvif-ptz
[commits-shield]: https://img.shields.io/github/commit-activity/y/rbtying/hass-onvif-ptz.svg?style=for-the-badge
[commits]: https://github.com/rbtying/hass-onvif-ptz/commits/main
[hacs]: https://github.com/hacs/integration
[hacsbadge]: https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge
[releases-shield]: https://img.shields.io/github/release/rbtying/hass-onvif-ptz.svg?style=for-the-badge
[releases]: https://github.com/rbtying/hass-onvif-ptz/releases
