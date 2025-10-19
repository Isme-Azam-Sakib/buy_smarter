from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class Vendor(Base):
    __tablename__ = "vendors"

    vendor_id = Column('vendorId', Integer, primary_key=True, index=True)
    name = Column('name', String, unique=True, index=True)
    website = Column('website', String)
    logo_url = Column('logoUrl', String, nullable=True)
    is_active = Column('isActive', Boolean, default=True)
    created_at = Column('createdAt', DateTime(timezone=True), server_default=func.now())
    updated_at = Column('updatedAt', DateTime(timezone=True), onupdate=func.now())

    price_entries = relationship("PriceEntry", back_populates="vendor")

class MasterProduct(Base):
    __tablename__ = "master_products"

    product_id = Column('productId', Integer, primary_key=True, index=True)
    standard_name = Column('standardName', String, index=True)
    category = Column('category', String, index=True)
    brand = Column('brand', String, index=True)
    current_cheapest_price = Column('currentCheapestPrice', Float, nullable=True)
    key_specs_json = Column('keySpecsJson', JSON, nullable=True)
    image_urls = Column('imageUrls', JSON, default=list)
    created_at = Column('createdAt', DateTime(timezone=True), server_default=func.now())
    updated_at = Column('updatedAt', DateTime(timezone=True), onupdate=func.now())

    price_entries = relationship("PriceEntry", back_populates="master_product")
    cpu_specs = relationship("CpuSpecs", back_populates="master_product", uselist=False)
    gpu_specs = relationship("GpuSpecs", back_populates="master_product", uselist=False)
    ram_specs = relationship("RamSpecs", back_populates="master_product", uselist=False)
    motherboard_specs = relationship("MotherboardSpecs", back_populates="master_product", uselist=False)
    psu_specs = relationship("PsuSpecs", back_populates="master_product", uselist=False)
    ssd_specs = relationship("SsdSpecs", back_populates="master_product", uselist=False)
    hdd_specs = relationship("HddSpecs", back_populates="master_product", uselist=False)
    case_specs = relationship("CaseSpecs", back_populates="master_product", uselist=False)

class PriceEntry(Base):
    __tablename__ = "price_entries"

    id = Column('id', Integer, primary_key=True, index=True)
    master_product_id = Column('masterProductId', Integer, ForeignKey("master_products.productId"))
    vendor_id = Column('vendorId', Integer, ForeignKey("vendors.vendorId"))
    scraped_price = Column('scrapedPrice', Float)
    availability_status = Column('availabilityStatus', String, default="in_stock")
    scraped_timestamp = Column('scrapedTimestamp', DateTime(timezone=True), server_default=func.now())
    product_url = Column('productUrl', String, nullable=True)

    master_product = relationship("MasterProduct", back_populates="price_entries")
    vendor = relationship("Vendor", back_populates="price_entries")

class CpuSpecs(Base):
    __tablename__ = "cpu_specs"

    product_id = Column(Integer, ForeignKey("master_products.productId"), primary_key=True)
    socket_type = Column(String)
    tdp_watts = Column(Integer)
    core_count = Column(Integer)
    thread_count = Column(Integer)
    base_clock = Column(Float)
    boost_clock = Column(Float)
    cache_l3 = Column(Integer, nullable=True)
    integrated_graphics = Column(String, nullable=True)

    master_product = relationship("MasterProduct", back_populates="cpu_specs")

class GpuSpecs(Base):
    __tablename__ = "gpu_specs"

    product_id = Column(Integer, ForeignKey("master_products.productId"), primary_key=True)
    memory_size = Column(Integer)
    memory_type = Column(String)
    base_clock = Column(Float)
    boost_clock = Column(Float)
    tdp_watts = Column(Integer)
    memory_bus_width = Column(Integer)
    cuda_cores = Column(Integer, nullable=True)

    master_product = relationship("MasterProduct", back_populates="gpu_specs")

class RamSpecs(Base):
    __tablename__ = "ram_specs"

    product_id = Column(Integer, ForeignKey("master_products.productId"), primary_key=True)
    capacity = Column(Integer)
    speed = Column(Integer)
    type = Column(String)
    cas_latency = Column(Integer)
    voltage = Column(Float)
    form_factor = Column(String)

    master_product = relationship("MasterProduct", back_populates="ram_specs")

class MotherboardSpecs(Base):
    __tablename__ = "motherboard_specs"

    product_id = Column(Integer, ForeignKey("master_products.productId"), primary_key=True)
    socket_type = Column(String)
    chipset = Column(String)
    form_factor = Column(String)
    memory_slots = Column(Integer)
    memory_type = Column(String)
    max_memory = Column(Integer)
    pcie_slots = Column(Integer)
    sata_ports = Column(Integer)
    m2_slots = Column(Integer)
    usb_ports = Column(Integer)

    master_product = relationship("MasterProduct", back_populates="motherboard_specs")

class PsuSpecs(Base):
    __tablename__ = "psu_specs"

    product_id = Column(Integer, ForeignKey("master_products.productId"), primary_key=True)
    wattage = Column(Integer)
    efficiency = Column(String)
    modularity = Column(String)
    form_factor = Column(String)
    pcie_connectors = Column(Integer)
    sata_connectors = Column(Integer)
    molex_connectors = Column(Integer)

    master_product = relationship("MasterProduct", back_populates="psu_specs")

class SsdSpecs(Base):
    __tablename__ = "ssd_specs"

    product_id = Column(Integer, ForeignKey("master_products.productId"), primary_key=True)
    capacity = Column(Integer)
    interface = Column(String)
    form_factor = Column(String)
    read_speed = Column(Integer)
    write_speed = Column(Integer)
    tbw = Column(Integer, nullable=True)
    endurance = Column(String, nullable=True)

    master_product = relationship("MasterProduct", back_populates="ssd_specs")

class HddSpecs(Base):
    __tablename__ = "hdd_specs"

    product_id = Column(Integer, ForeignKey("master_products.productId"), primary_key=True)
    capacity = Column(Integer)
    rpm = Column(Integer)
    interface = Column(String)
    cache = Column(Integer)
    form_factor = Column(String)

    master_product = relationship("MasterProduct", back_populates="hdd_specs")

class CaseSpecs(Base):
    __tablename__ = "case_specs"

    product_id = Column(Integer, ForeignKey("master_products.productId"), primary_key=True)
    form_factor = Column(String)
    max_gpu_length = Column(Integer, nullable=True)
    max_cpu_height = Column(Integer, nullable=True)
    drive_bays = Column(Integer)
    fan_mounts = Column(Integer)
    usb_ports = Column(Integer)
    rgb_support = Column(Boolean, default=False)

    master_product = relationship("MasterProduct", back_populates="case_specs")

class RawVendorProduct(Base):
    __tablename__ = "raw_vendor_products"

    id = Column(Integer, primary_key=True, index=True)
    vendor_name = Column(String, index=True)
    category = Column(String, index=True)
    raw_name = Column(String, index=True)
    price_bdt = Column(Float, nullable=True)
    availability_status = Column(String, default="in_stock")
    product_url = Column(String, unique=False, index=True)
    image_url = Column(String, nullable=True)
    currency = Column(String, default="BDT")
    scraped_at = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# Temporarily comment out UserBuild to avoid foreign key issues
# class UserBuild(Base):
#     __tablename__ = "user_builds"

#     build_id = Column(Integer, primary_key=True, index=True)
#     user_id = Column(String, nullable=True)
#     build_name = Column(String)
#     total_price = Column(Float, nullable=True)
#     created_at = Column(DateTime(timezone=True), server_default=func.now())
#     updated_at = Column(DateTime(timezone=True), onupdate=func.now())

#     build_components = relationship("BuildComponent", back_populates="build")

# Temporarily comment out BuildComponent to avoid foreign key issues
# class BuildComponent(Base):
#     __tablename__ = "build_components"

#     id = Column(Integer, primary_key=True, index=True)
#     build_id = Column(Integer, ForeignKey("user_builds.buildId"))
#     product_id = Column(Integer, ForeignKey("master_products.productId"))
#     quantity = Column(Integer, default=1)

#     build = relationship("UserBuild", back_populates="build_components")
#     master_product = relationship("MasterProduct")
