#!/usr/bin/env python3
"""
ClipSync Desktop Clipboard Sync Script
Watches your system clipboard and syncs new items to your ClipSync server.

Usage:
  pip install pyperclip requests
  python clipboard_sync.py --server https://your-clipsync-url.replit.app

Options:
  --server URL    Your ClipSync server URL (required)
  --interval N    Check interval in seconds (default: 2)
  --pull          Also pull latest clip from server to local clipboard
  --category CAT  Category for new clips (default: clipboard)
"""

import argparse
import hashlib
import json
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
        resp = requests.post(f"{server}/api/clips", json=payload, timeout=10)
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
        resp = requests.get(f"{server}/api/clips", timeout=10)
        if resp.status_code == 200:
            clips = resp.json()
            active = [c for c in clips if not c.get("deleted")]
            if active:
                active.sort(key=lambda c: c.get("createdAt", ""), reverse=True)
                return active[0].get("content", "")
        return None
    except requests.RequestException:
        return None


def main():
    parser = argparse.ArgumentParser(description="ClipSync Desktop Clipboard Sync")
    parser.add_argument("--server", required=True, help="ClipSync server URL")
    parser.add_argument("--interval", type=float, default=2.0, help="Check interval in seconds")
    parser.add_argument("--pull", action="store_true", help="Also pull latest clip from server")
    parser.add_argument("--category", default="clipboard", help="Category for new clips")
    args = parser.parse_args()

    server = args.server.rstrip("/")
    print(f"ClipSync Desktop Sync")
    print(f"  Server: {server}")
    print(f"  Interval: {args.interval}s")
    print(f"  Pull mode: {'enabled' if args.pull else 'disabled'}")
    print(f"  Category: {args.category}")
    print(f"  Press Ctrl+C to stop\n")

    try:
        resp = requests.get(f"{server}/api/clips", timeout=10)
        if resp.status_code == 200:
            print("[OK] Connected to server successfully")
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
