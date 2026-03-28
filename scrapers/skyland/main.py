from __future__ import annotations

from .. import sync_vendor_to_db


def main() -> int:
    stats = sync_vendor_to_db("skyland")
    print(stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
