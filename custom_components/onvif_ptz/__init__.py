"""Custom integration to support general ONVIF PTZ commands in Home Assistant.

Based substantially on the core ONVIF integration.
For more details about this integration, please refer to https://github.com/rbtying/hass-onvif-ptz
"""

from __future__ import annotations


from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    EVENT_HOMEASSISTANT_STOP,
    Platform,
)
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady

from .const import DOMAIN
from .device import ONVIFDevice


async def async_setup(hass: HomeAssistant, config) -> bool:
    """Register the static path for the Lovelace card."""
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            url_path="/onvif_ptz/onvif-ptz-preset-card.js",
            path=hass.config.path(
                "custom_components/onvif_ptz/www/onvif-ptz-preset-card.js"
            ),
            cache_headers=False,
        )
    ])
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up ONVIF from a config entry."""
    if DOMAIN not in hass.data:
        hass.data[DOMAIN] = {}

    if not entry.options:
        await async_populate_options(hass, entry)

    device = ONVIFDevice(hass, entry)

    if not await device.async_setup():
        await device.device.close()
        return False

    if not device.available:
        raise ConfigEntryNotReady()

    hass.data[DOMAIN][entry.unique_id] = device

    platforms = [Platform.BUTTON]

    await hass.config_entries.async_forward_entry_setups(entry, platforms)

    entry.async_on_unload(
        hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STOP, device.async_stop)
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""

    device = hass.data[DOMAIN].pop(entry.unique_id)
    await device.async_stop()
    platforms = [Platform.BUTTON]

    return await hass.config_entries.async_unload_platforms(entry, platforms)


async def async_populate_options(hass, entry):
    """Populate default options for device."""
    options = {}

    hass.config_entries.async_update_entry(entry, options=options)
