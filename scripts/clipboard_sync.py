#!/usr/bin/env python3
"""
ClipSync Desktop Clipboard Sync Script
Watches your system clipboard and syncs new items to your ClipSync server.

Usage:
  pip install pyperclip requests
  python clipboard_sync.py --server http://NAS-IP:5000 --api-key YOUR_KEY

Options:
  --server URL    Your ClipSync server URL (required)
  --interval N    Check interval in seconds (default: 2)
  --pull          Also pull latest clip from server to local clipboard
  --category CAT  Category for new clips (default: clipboard)
  --api-key KEY   Server API key (or set CLIPSYNC_API_KEY)

Through Cloudflare Access from outside the house, also set CF_ACCESS_CLIENT_ID and
CF_ACCESS_CLIENT_SECRET (an Access service token); at home, use the NAS address directly.
"""

import argparse
import hashlib
import json
import os
import sys
import time

try:
    import pyperclip
    import requests
except ImportError:
    print("Missing dependencies. Install them with:")
    print("  pip install pyperclip requests")
    sys.exit(1)


def get_clip_hash(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


session = requests.Session()


def configure_session(api_key: str) -> None:
    if api_key:
        session.headers["X-API-Key"] = api_key
    client_id = os.environ.get("CF_ACCESS_CLIENT_ID")
    client_secret = os.environ.get("CF_ACCESS_CLIENT_SECRET")
    if client_id and client_secret:
        session.headers["CF-Access-Client-Id"] = client_id
        session.headers["CF-Access-Client-Secret"] = client_secret


def push_clip(server: str, content: str, category: str = "clipboard"):
    title = content[:60].strip().replace("\n", " ")
    if len(content) > 60:
        title += "..."

    payload = {
        "title": title,
        "content": content,
        "category": category,
    }

    try:
        resp = session.post(f"{server}/api/clips", json=payload, timeout=10)
        if resp.status_code == 201:
            clip = resp.json()
            print(f"[PUSH] Synced clip: {clip['id'][:8]}... | {title[:40]}")
            return True
        else:
            print(f"[ERROR] Push failed: {resp.status_code} {resp.text[:100]}")
            return False
    except requests.RequestException as e:
        print(f"[ERROR] Connection failed: {e}")
        return False


def pull_latest(server: str) -> str | None:
    try:
        # Newest few only: the full list is thousands of clips.
        resp = session.get(f"{server}/api/clips", params={"limit": 5}, timeout=10)
        if resp.status_code != 200:
            return None
        active = [c for c in resp.json() if not c.get("deleted")]
        if not active:
            return None
        newest = max(active, key=lambda c: c.get("createdAt", ""))
        if newest.get("truncated"):
            full = session.get(f"{server}/api/clips/{newest['id']}", timeout=30)
            return full.json().get("content", "") if full.status_code == 200 else None
        return newest.get("content", "")
    except requests.RequestException:
        return None


def main():
    parser = argparse.ArgumentParser(description="ClipSync Desktop Clipboard Sync")
    parser.add_argument("--server", required=True, help="ClipSync server URL")
    parser.add_argument("--interval", type=float, default=2.0, help="Check interval in seconds")
    parser.add_argument("--pull", action="store_true", help="Also pull latest clip from server")
    parser.add_argument("--category", default="clipboard", help="Category for new clips")
    parser.add_argument("--api-key", default=os.environ.get("CLIPSYNC_API_KEY", ""), help="Server API key")
    args = parser.parse_args()
    configure_session(args.api_key)

    server = args.server.rstrip("/")
    print(f"ClipSync Desktop Sync")
    print(f"  Server: {server}")
    print(f"  Interval: {args.interval}s")
    print(f"  Pull mode: {'enabled' if args.pull else 'disabled'}")
    print(f"  Category: {args.category}")
    print(f"  Press Ctrl+C to stop\n")

    try:
        resp = session.get(f"{server}/api/clips", params={"limit": 1}, timeout=10)
        if resp.status_code == 200:
            print("[OK] Connected to server successfully")
        elif resp.status_code == 401:
            print("[ERROR] The server wants an API key: pass --api-key or set CLIPSYNC_API_KEY")
            sys.exit(1)
        else:
            print(f"[WARN] Server responded with {resp.status_code}")
    except requests.RequestException as e:
        print(f"[ERROR] Cannot connect to server: {e}")
        sys.exit(1)

    last_hash = ""
    last_server_hash = ""

    try:
        current = pyperclip.paste()
        if current:
            last_hash = get_clip_hash(current)
    except Exception:
        pass

    print("[RUNNING] Watching clipboard...\n")

    try:
        while True:
            try:
                current = pyperclip.paste()
                if current and current.strip():
                    current_hash = get_clip_hash(current)
                    if current_hash != last_hash:
                        last_hash = current_hash
                        push_clip(server, current, args.category)

                if args.pull:
                    server_content = pull_latest(server)
                    if server_content:
                        server_hash = get_clip_hash(server_content)
                        if server_hash != last_server_hash and server_hash != last_hash:
                            last_server_hash = server_hash
                            pyperclip.copy(server_content)
                            last_hash = server_hash
                            preview = server_content[:40].replace("\n", " ")
                            print(f"[PULL] Got from server: {preview}...")

            except Exception as e:
                print(f"[ERROR] {e}")

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print("\n[STOPPED] Clipboard sync stopped.")


if __name__ == "__main__":
    main()
