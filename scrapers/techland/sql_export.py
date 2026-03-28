from __future__ import annotations
from typing import Iterable, Dict

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name VARCHAR(64) NOT NULL,
  category VARCHAR(64) NOT NULL,
  raw_name TEXT,
  price_bdt DECIMAL(15,2),
  availability_status VARCHAR(32),
  product_url TEXT,
  image_url TEXT,
  currency VARCHAR(8),
  description JSON NULL,
  scraped_at DATETIME,
  created_at DATETIME,
  updated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
""".strip()


def escape_sql(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "''")


def to_insert_row(row: Dict[str, object]) -> str:
    def v(key: str):
        val = row.get(key)
        if val is None:
            return "NULL"
        if isinstance(val, (int, float)):
            return f"{val}"
        return f"'{escape_sql(str(val))}'"

    cols = [
        "vendor_name",
        "category",
        "raw_name",
        "price_bdt",
        "availability_status",
        "product_url",
        "image_url",
        "currency",
        "description",
        "scraped_at",
        "created_at",
        "updated_at",
    ]
    values = ", ".join(v(c) for c in cols)
    return f"INSERT INTO products ({', '.join(cols)}) VALUES ({values});"


def write_sql(output_path: str, rows: Iterable[Dict[str, object]]) -> None:
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(SCHEMA_SQL + "\n\n")
        for row in rows:
            f.write(to_insert_row(row) + "\n")
