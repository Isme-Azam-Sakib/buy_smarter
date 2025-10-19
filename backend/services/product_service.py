from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc
from typing import List, Optional
from models import MasterProduct, Vendor, PriceEntry
from schemas import ProductResponse, PriceEntryResponse, VendorResponse

class ProductService:
    async def get_products(
        self, 
        db: Session, 
        category: Optional[str] = None,
        brand: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[ProductResponse]:
        """Get products with optional filtering"""
        query = db.query(MasterProduct)
        
        if category:
            query = query.filter(MasterProduct.category == category)
        
        if brand:
            query = query.filter(MasterProduct.brand == brand)
        
        if search:
            query = query.filter(
                or_(
                    MasterProduct.standard_name.ilike(f"%{search}%"),
                    MasterProduct.brand.ilike(f"%{search}%")
                )
            )
        
        products = query.offset(offset).limit(limit).all()
        return [ProductResponse.from_orm(product) for product in products]

    async def get_product_by_id(self, db: Session, product_id: int) -> Optional[ProductResponse]:
        """Get a specific product by ID"""
        product = db.query(MasterProduct).filter(MasterProduct.product_id == product_id).first()
        if product:
            return ProductResponse.from_orm(product)
        return None

    async def get_product_prices(self, db: Session, product_id: int) -> List[PriceEntryResponse]:
        """Get all price entries for a specific product"""
        prices = db.query(PriceEntry).filter(
            PriceEntry.master_product_id == product_id
        ).order_by(PriceEntry.scraped_price).all()
        
        return [PriceEntryResponse.from_orm(price) for price in prices]

    async def get_vendors(self, db: Session) -> List[VendorResponse]:
        """Get all active vendors"""
        vendors = db.query(Vendor).filter(Vendor.is_active == True).all()
        return [VendorResponse.from_orm(vendor) for vendor in vendors]

    async def search_products(
        self, 
        db: Session, 
        query: str, 
        limit: int = 10
    ) -> List[ProductResponse]:
        """Search products by name or brand"""
        products = db.query(MasterProduct).filter(
            or_(
                MasterProduct.standard_name.ilike(f"%{query}%"),
                MasterProduct.brand.ilike(f"%{query}%")
            )
        ).limit(limit).all()
        
        return [ProductResponse.from_orm(product) for product in products]

    async def get_cheapest_products(
        self, 
        db: Session, 
        category: Optional[str] = None,
        limit: int = 10
    ) -> List[ProductResponse]:
        """Get cheapest products in each category"""
        query = db.query(MasterProduct).filter(
            MasterProduct.current_cheapest_price.isnot(None)
        )
        
        if category:
            query = query.filter(MasterProduct.category == category)
        
        products = query.order_by(MasterProduct.current_cheapest_price).limit(limit).all()
        return [ProductResponse.from_orm(product) for product in products]

    async def get_products_by_category(
        self, 
        db: Session, 
        category: str,
        limit: int = 20,
        offset: int = 0
    ) -> List[ProductResponse]:
        """Get products by category"""
        products = db.query(MasterProduct).filter(
            MasterProduct.category == category
        ).offset(offset).limit(limit).all()
        
        return [ProductResponse.from_orm(product) for product in products]

    async def get_price_history(
        self, 
        db: Session, 
        product_id: int,
        days: int = 30
    ) -> List[PriceEntryResponse]:
        """Get price history for a product"""
        from datetime import datetime, timedelta
        
        start_date = datetime.now() - timedelta(days=days)
        
        prices = db.query(PriceEntry).filter(
            and_(
                PriceEntry.master_product_id == product_id,
                PriceEntry.scraped_timestamp >= start_date
            )
        ).order_by(PriceEntry.scraped_timestamp.desc()).all()
        
        return [PriceEntryResponse.from_orm(price) for price in prices]
