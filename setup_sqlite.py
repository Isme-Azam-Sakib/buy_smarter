#!/usr/bin/env python3
"""
Quick setup with SQLite database for immediate testing
"""

import os
import sys
from pathlib import Path

def setup_sqlite():
    """Set up SQLite database for quick testing"""
    print("Setting up SQLite database for quick testing...")
    
    # Update .env file for SQLite
    env_content = """# Database (SQLite for quick testing)
DATABASE_URL="file:./buysmarter.db"

# Gemini Pro API
GEMINI_API_KEY="your_gemini_api_key_here"

# Scraper Configuration
SCRAPER_BASE_URL="http://localhost:8000"
REDIS_URL="redis://localhost:6379"

# Next.js
NEXTAUTH_SECRET="your_nextauth_secret_here"
NEXTAUTH_URL="http://localhost:3000"
"""
    
    with open('.env', 'w') as f:
        f.write(env_content)
    
    print("[OK] Updated .env file for SQLite")
    
    # Update Prisma schema for SQLite
    prisma_schema = """// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Vendor {
  vendorId    Int      @id @default(autoincrement())
  name        String   @unique
  website     String
  logoUrl     String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  priceEntries PriceEntry[]

  @@map("vendors")
}

model MasterProduct {
  productId            Int      @id @default(autoincrement())
  standardName         String
  category             String
  brand                String
  currentCheapestPrice Float?
  keySpecsJson         String?
  imageUrls            String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  priceEntries PriceEntry[]
  buildComponents BuildComponent[]
  cpuSpecs     CpuSpecs?
  gpuSpecs     GpuSpecs?
  ramSpecs     RamSpecs?
  motherboardSpecs MotherboardSpecs?
  psuSpecs     PsuSpecs?
  ssdSpecs     SsdSpecs?
  hddSpecs     HddSpecs?
  caseSpecs    CaseSpecs?

  @@map("master_products")
}

model PriceEntry {
  id                  Int      @id @default(autoincrement())
  masterProductId     Int
  vendorId            Int
  scrapedPrice        Float
  availabilityStatus  String   @default("in_stock")
  scrapedTimestamp    DateTime @default(now())
  productUrl          String?

  masterProduct MasterProduct @relation(fields: [masterProductId], references: [productId], onDelete: Cascade)
  vendor        Vendor        @relation(fields: [vendorId], references: [vendorId])

  @@map("price_entries")
}

model CpuSpecs {
  productId    Int     @id
  socketType   String
  tdpWatts     Int
  coreCount    Int
  threadCount  Int
  baseClock    Float
  boostClock   Float
  cacheL3      Int?
  integratedGraphics String?

  masterProduct MasterProduct @relation(fields: [productId], references: [productId], onDelete: Cascade)

  @@map("cpu_specs")
}

model GpuSpecs {
  productId      Int     @id
  memorySize     Int
  memoryType     String
  baseClock      Float
  boostClock     Float
  tdpWatts       Int
  memoryBusWidth Int
  cudaCores      Int?

  masterProduct MasterProduct @relation(fields: [productId], references: [productId], onDelete: Cascade)

  @@map("gpu_specs")
}

model RamSpecs {
  productId     Int     @id
  capacity      Int
  speed         Int
  type          String
  casLatency    Int
  voltage       Float
  formFactor    String

  masterProduct MasterProduct @relation(fields: [productId], references: [productId], onDelete: Cascade)

  @@map("ram_specs")
}

model MotherboardSpecs {
  productId        Int     @id
  socketType       String
  chipset          String
  formFactor       String
  memorySlots      Int
  memoryType       String
  maxMemory        Int
  pcieSlots        Int
  sataPorts        Int
  m2Slots          Int
  usbPorts         Int

  masterProduct MasterProduct @relation(fields: [productId], references: [productId], onDelete: Cascade)

  @@map("motherboard_specs")
}

model PsuSpecs {
  productId     Int     @id
  wattage       Int
  efficiency    String
  modularity    String
  formFactor    String
  pcieConnectors Int
  sataConnectors Int
  molexConnectors Int

  masterProduct MasterProduct @relation(fields: [productId], references: [productId], onDelete: Cascade)

  @@map("psu_specs")
}

model SsdSpecs {
  productId     Int     @id
  capacity      Int
  interface     String
  formFactor    String
  readSpeed     Int
  writeSpeed    Int
  tbw           Int?
  endurance     String?

  masterProduct MasterProduct @relation(fields: [productId], references: [productId], onDelete: Cascade)

  @@map("ssd_specs")
}

model HddSpecs {
  productId     Int     @id
  capacity      Int
  rpm           Int
  interface     String
  cache         Int
  formFactor    String

  masterProduct MasterProduct @relation(fields: [productId], references: [productId], onDelete: Cascade)

  @@map("hdd_specs")
}

model CaseSpecs {
  productId     Int     @id
  formFactor    String
  maxGpuLength  Int?
  maxCpuHeight  Int?
  driveBays     Int
  fanMounts     Int
  usbPorts      Int
  rgbSupport    Boolean @default(false)

  masterProduct MasterProduct @relation(fields: [productId], references: [productId], onDelete: Cascade)

  @@map("case_specs")
}

model UserBuild {
  buildId       Int      @id @default(autoincrement())
  userId        String?
  buildName     String
  totalPrice    Float?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  buildComponents BuildComponent[]

  @@map("user_builds")
}

model BuildComponent {
  id        Int @id @default(autoincrement())
  buildId   Int
  productId Int
  quantity  Int @default(1)

  build         UserBuild     @relation(fields: [buildId], references: [buildId], onDelete: Cascade)
  masterProduct MasterProduct @relation(fields: [productId], references: [productId])

  @@map("build_components")
}
"""
    
    with open('prisma/schema.prisma', 'w') as f:
        f.write(prisma_schema)
    
    print("[OK] Updated Prisma schema for SQLite")
    
    # Generate Prisma client
    os.system("npm run db:generate")
    print("[OK] Generated Prisma client")
    
    # Push database schema
    os.system("npm run db:push")
    print("[OK] Created SQLite database")
    
    print("\n[OK] SQLite database setup complete!")
    print("Database file: buysmarter.db")
    print("You can now load your master products!")

if __name__ == "__main__":
    setup_sqlite()
