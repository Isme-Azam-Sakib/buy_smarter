# BuySmarter - PC Parts Price Comparison Bangladesh

A comprehensive web application for comparing PC parts prices across major retailers in Bangladesh, featuring AI-powered recommendations and PC building tools.

## Features

- **Price Comparison**: Find the cheapest prices across 6+ major retailers
- **PC Builder**: Interactive PC building tool with compatibility checking
- **AI Recommendations**: Smart component suggestions using Gemini Pro
- **Price Trend Analysis**: AI-powered buy/wait recommendations
- **Real-time Updates**: Regular price updates from vendor websites

## Tech Stack

### Frontend
- **Next.js 14** with TypeScript
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Lucide React** for icons

### Backend
- **Python FastAPI** for API
- **PostgreSQL** with Prisma ORM
- **Celery + Redis** for background tasks
- **Google Gemini Pro** for AI features

### Scraping
- **Scrapy** for web scraping
- **Playwright** for dynamic content
- **BeautifulSoup** for HTML parsing

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL 13+
- Redis 6+

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd buysmarter-pc-parts
   ```

2. **Install frontend dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

4. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Update the `.env` file with your configuration:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/buysmarter_pc_parts"
   GEMINI_API_KEY="your_gemini_api_key_here"
   REDIS_URL="redis://localhost:6379"
   ```

5. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push database schema
   npm run db:push
   ```

6. **Start the development servers**
   
   Frontend (Terminal 1):
   ```bash
   npm run dev
   ```
   
   Backend (Terminal 2):
   ```bash
   cd backend
   python main.py
   ```
   
   Redis (Terminal 3):
   ```bash
   redis-server
   ```

## Project Structure

```
buysmarter-pc-parts/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── Header.tsx         # Navigation header
│   ├── Hero.tsx           # Hero section
│   ├── PriceComparison.tsx # Price comparison component
│   ├── PCBuilder.tsx      # PC builder component
│   └── Footer.tsx         # Footer component
├── backend/               # Python backend
│   ├── main.py           # FastAPI application
│   ├── database.py       # Database configuration
│   ├── models.py         # SQLAlchemy models
│   ├── schemas.py        # Pydantic schemas
│   ├── services/         # Business logic
│   │   ├── product_service.py
│   │   ├── ai_service.py
│   │   └── scraper_service.py
│   └── requirements.txt  # Python dependencies
├── prisma/               # Database schema
│   └── schema.prisma     # Prisma schema
├── package.json          # Node.js dependencies
├── next.config.js        # Next.js configuration
├── tailwind.config.js    # Tailwind CSS configuration
└── README.md            # This file
```

## Database Schema

### Core Tables
- **MasterProduct**: Central product catalog
- **Vendor**: Retailer information
- **PriceEntry**: Historical price data
- **UserBuild**: Saved PC builds

### Specification Tables
- **CpuSpecs**: CPU specifications
- **GpuSpecs**: GPU specifications
- **RamSpecs**: RAM specifications
- **MotherboardSpecs**: Motherboard specifications
- **PsuSpecs**: Power supply specifications
- **SsdSpecs**: SSD specifications
- **HddSpecs**: HDD specifications
- **CaseSpecs**: Case specifications

## API Endpoints

### Products
- `GET /products` - Get products with filtering
- `GET /products/{id}` - Get specific product
- `GET /products/{id}/prices` - Get product prices

### Vendors
- `GET /vendors` - Get all vendors

### Scraping
- `POST /scraper/start` - Start scraping process
- `GET /scraper/status/{task_id}` - Get scraping status

### AI Features
- `POST /ai/recommend-components` - Get component recommendations
- `POST /ai/check-compatibility` - Check build compatibility
- `POST /ai/price-trend` - Analyze price trends

## Scraping Strategy

### Two-Tier Product Reconciliation
1. **Level 1**: Fast fuzzy matching using RapidFuzz (95%+ confidence)
2. **Level 2**: AI-powered matching using Gemini Pro for complex cases

### Supported Vendors
- [TechLand BD](https://www.techlandbd.com/)
- [Skyland Computer BD](https://www.skyland.com.bd/)
- [Star Tech](https://www.startech.com.bd/)
- [Ryans](https://www.ryans.com/)
- [PC House BD](https://www.pchouse.com.bd/)
- [Ultra Tech BD](https://www.ultratech.com.bd/)

## AI Features

### Component Recommendations
- Analyzes current build
- Suggests compatible components
- Considers budget constraints
- Provides performance impact analysis

### Compatibility Checking
- Socket compatibility (CPU-Motherboard)
- RAM compatibility (Type, speed, capacity)
- Power supply adequacy
- Physical fit validation

### Price Trend Analysis
- Historical price analysis
- Buy now vs wait recommendations
- Confidence scoring
- Market trend insights

## Development

### Running Tests
```bash
# Frontend tests
npm run test

# Backend tests
cd backend
python -m pytest
```

### Database Management
```bash
# View database in Prisma Studio
npm run db:studio

# Create migration
npm run db:migrate

# Reset database
npm run db:push --force-reset
```

### Scraping
```bash
# Start scraping manually
cd backend
python -c "from services.scraper_service import ScraperService; import asyncio; asyncio.run(ScraperService().start_scraping())"
```

## Deployment

### Frontend (Vercel)
1. Connect GitHub repository to Vercel
2. Set environment variables
3. Deploy automatically

### Backend (Railway/Render)
1. Connect GitHub repository
2. Set environment variables
3. Deploy with Docker

### Database (Supabase/Neon)
1. Create PostgreSQL database
2. Update DATABASE_URL
3. Run migrations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support, email support@buysmarter.com or create an issue on GitHub.
