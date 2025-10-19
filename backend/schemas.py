from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

# Base schemas
class VendorBase(BaseModel):
    name: str
    website: str
    logo_url: Optional[str] = None
    is_active: bool = True

class VendorCreate(VendorBase):
    pass

class VendorResponse(VendorBase):
    vendor_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class MasterProductBase(BaseModel):
    standard_name: str
    category: str
    brand: str
    current_cheapest_price: Optional[float] = None
    key_specs_json: Optional[Dict[str, Any]] = None
    image_urls: List[str] = []

class MasterProductCreate(MasterProductBase):
    pass

class MasterProductResponse(MasterProductBase):
    product_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PriceEntryBase(BaseModel):
    scraped_price: float
    availability_status: str = "in_stock"
    product_url: Optional[str] = None

class PriceEntryCreate(PriceEntryBase):
    master_product_id: int
    vendor_id: int

class PriceEntryResponse(PriceEntryBase):
    id: int
    master_product_id: int
    vendor_id: int
    scraped_timestamp: datetime
    vendor: VendorResponse

    class Config:
        from_attributes = True

# Spec schemas
class CpuSpecsBase(BaseModel):
    socket_type: str
    tdp_watts: int
    core_count: int
    thread_count: int
    base_clock: float
    boost_clock: float
    cache_l3: Optional[int] = None
    integrated_graphics: Optional[str] = None

class CpuSpecsCreate(CpuSpecsBase):
    product_id: int

class CpuSpecsResponse(CpuSpecsBase):
    product_id: int

    class Config:
        from_attributes = True

class GpuSpecsBase(BaseModel):
    memory_size: int
    memory_type: str
    base_clock: float
    boost_clock: float
    tdp_watts: int
    memory_bus_width: int
    cuda_cores: Optional[int] = None

class GpuSpecsCreate(GpuSpecsBase):
    product_id: int

class GpuSpecsResponse(GpuSpecsBase):
    product_id: int

    class Config:
        from_attributes = True

class RamSpecsBase(BaseModel):
    capacity: int
    speed: int
    type: str
    cas_latency: int
    voltage: float
    form_factor: str

class RamSpecsCreate(RamSpecsBase):
    product_id: int

class RamSpecsResponse(RamSpecsBase):
    product_id: int

    class Config:
        from_attributes = True

# AI request/response schemas
class ComponentRecommendationRequest(BaseModel):
    current_build: Dict[str, Any]
    budget: Optional[float] = None
    category: Optional[str] = None

class ComponentRecommendationResponse(BaseModel):
    recommendations: List[Dict[str, Any]]
    reasoning: str
    budget_analysis: Optional[Dict[str, Any]] = None

class CompatibilityCheckRequest(BaseModel):
    build_components: List[Dict[str, Any]]

class CompatibilityCheckResponse(BaseModel):
    is_compatible: bool
    issues: List[str]
    suggestions: List[str]
    power_requirement: Optional[int] = None

class PriceTrendAnalysisRequest(BaseModel):
    product_id: int
    days: int = 30

class PriceTrendAnalysisResponse(BaseModel):
    current_price: float
    price_trend: str  # "up", "down", "stable"
    recommendation: str  # "buy_now", "wait", "watch"
    confidence: float
    analysis: str
