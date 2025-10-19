from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from dotenv import load_dotenv

from database import get_db, engine
from models import Base
from schemas import ProductResponse, PriceEntryResponse, VendorResponse
from services.product_service import ProductService
from services.scraper_service import ScraperService
from services.ai_service import AIService

# Load environment variables
load_dotenv()

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="BuySmarter PC Parts API",
    description="API for PC parts price comparison and PC builder functionality",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
product_service = ProductService()
scraper_service = ScraperService()
ai_service = AIService()

@app.get("/")
async def root():
    return {"message": "BuySmarter PC Parts API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Product endpoints
@app.get("/products", response_model=List[ProductResponse])
async def get_products(
    category: Optional[str] = None,
    brand: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get products with optional filtering"""
    try:
        products = await product_service.get_products(
            db, category=category, brand=brand, search=search, 
            limit=limit, offset=offset
        )
        return products
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get a specific product by ID"""
    try:
        product = await product_service.get_product_by_id(db, product_id)
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return product
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/products/{product_id}/prices", response_model=List[PriceEntryResponse])
async def get_product_prices(product_id: int, db: Session = Depends(get_db)):
    """Get all price entries for a specific product"""
    try:
        prices = await product_service.get_product_prices(db, product_id)
        return prices
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Vendor endpoints
@app.get("/vendors", response_model=List[VendorResponse])
async def get_vendors(db: Session = Depends(get_db)):
    """Get all active vendors"""
    try:
        vendors = await product_service.get_vendors(db)
        return vendors
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Scraper endpoints
@app.post("/scraper/start")
async def start_scraping():
    """Start the scraping process"""
    try:
        result = await scraper_service.start_scraping()
        return {"message": "Scraping started", "task_id": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/scraper/status/{task_id}")
async def get_scraping_status(task_id: str):
    """Get scraping task status"""
    try:
        status = await scraper_service.get_task_status(task_id)
        return status
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# AI endpoints
@app.post("/ai/recommend-components")
async def recommend_components(
    current_build: dict,
    budget: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """Get AI recommendations for next component"""
    try:
        recommendations = await ai_service.recommend_components(
            db, current_build, budget
        )
        return recommendations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/check-compatibility")
async def check_compatibility(build_components: List[dict], db: Session = Depends(get_db)):
    """Check PC build compatibility using AI"""
    try:
        analysis = await ai_service.check_build_compatibility(db, build_components)
        return analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/price-trend")
async def analyze_price_trend(product_id: int, db: Session = Depends(get_db)):
    """Analyze price trend for a product"""
    try:
        trend_analysis = await ai_service.analyze_price_trend(db, product_id)
        return trend_analysis
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
