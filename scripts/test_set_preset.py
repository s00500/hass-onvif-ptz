#!/usr/bin/env python3
"""Test script to debug SetPreset behavior against a real ONVIF camera.

Usage:
    python3 scripts/test_set_preset.py --host 192.168.1.100 --user admin --password secret
    python3 scripts/test_set_preset.py --host 192.168.1.100 --user admin --password secret --port 8000
"""

import argparse
import asyncio
import os
import sys

import onvif
from onvif import ONVIFCamera


async def main():
    parser = argparse.ArgumentParser(description="Test ONVIF SetPreset")
    parser.add_argument("--host", required=True)
    parser.add_argument("--port", type=int, default=80)
    parser.add_argument("--user", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    wsdl_dir = f"{os.path.dirname(onvif.__file__)}/wsdl/"
    cam = ONVIFCamera(args.host, args.port, args.user, args.password, wsdl_dir, no_cache=True)

    print(f"Connecting to {args.host}:{args.port} ...")
    await cam.update_xaddrs()

    media = await cam.create_media_service()
    ptz = await cam.create_ptz_service()

    profiles = await media.GetProfiles()
    profile_token = profiles[0].token
    print(f"Using profile: {profile_token}\n")

    # --- GetPresets ---
    print("=" * 60)
    print("GetPresets")
    print("=" * 60)
    req = ptz.create_type("GetPresets")
    req.ProfileToken = profile_token
    presets = await ptz.GetPresets(req)
    if presets:
        for p in presets:
            token = p.token if hasattr(p, "token") else getattr(p, "_token", "?")
            name = p.Name if hasattr(p, "Name") else "?"
            print(f"  token={token!r}  name={name!r}")
    else:
        print("  (no presets)")
    print()

    # --- SetPreset: create new (no token) ---
    print("=" * 60)
    print("SetPreset — create NEW preset (no token, name='test_new')")
    print("=" * 60)
    req = ptz.create_type("SetPreset")
    req.ProfileToken = profile_token
    req.PresetName = "test_new"
    print(f"  Request: {req}")
    try:
        resp = await ptz.SetPreset(req)
        print(f"  Response: {resp}")
        print(f"  Type: {type(resp)}")
        new_token = resp
    except Exception as e:
        print(f"  ERROR: {type(e).__name__}: {e}")
        new_token = None
    print()

    # --- GetPresets again to see the new one ---
    print("=" * 60)
    print("GetPresets (after create)")
    print("=" * 60)
    req = ptz.create_type("GetPresets")
    req.ProfileToken = profile_token
    presets = await ptz.GetPresets(req)
    if presets:
        for p in presets:
            token = p.token if hasattr(p, "token") else getattr(p, "_token", "?")
            name = p.Name if hasattr(p, "Name") else "?"
            print(f"  token={token!r}  name={name!r}")
    print()

    # --- SetPreset: update existing (with token) ---
    if new_token:
        print("=" * 60)
        print(f"SetPreset — UPDATE existing token={new_token!r}, name='test_updated'")
        print("=" * 60)
        req = ptz.create_type("SetPreset")
        req.ProfileToken = profile_token
        req.PresetToken = str(new_token)
        req.PresetName = "test_updated"
        print(f"  Request: {req}")
        try:
            resp = await ptz.SetPreset(req)
            print(f"  Response: {resp}")
        except Exception as e:
            print(f"  ERROR: {type(e).__name__}: {e}")
        print()

        # --- SetPreset: update position only (token, no name) ---
        print("=" * 60)
        print(f"SetPreset — UPDATE position only token={new_token!r}, no name")
        print("=" * 60)
        req = ptz.create_type("SetPreset")
        req.ProfileToken = profile_token
        req.PresetToken = str(new_token)
        print(f"  Request: {req}")
        try:
            resp = await ptz.SetPreset(req)
            print(f"  Response: {resp}")
        except Exception as e:
            print(f"  ERROR: {type(e).__name__}: {e}")
        print()

    # --- Cleanup: remove the test preset ---
    if new_token:
        print("=" * 60)
        print(f"RemovePreset — cleanup token={new_token!r}")
        print("=" * 60)
        req = ptz.create_type("RemovePreset")
        req.ProfileToken = profile_token
        req.PresetToken = str(new_token)
        print(f"  Request: {req}")
        try:
            resp = await ptz.RemovePreset(req)
            print(f"  Response: {resp}")
        except Exception as e:
            print(f"  ERROR: {type(e).__name__}: {e}")
        print()

    await cam.close()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
