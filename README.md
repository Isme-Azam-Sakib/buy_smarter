# BuySmarter - CPU Price Comparison

A modern Next.js application for comparing CPU prices across multiple vendors in Bangladesh, featuring AI-powered product recognition and price aggregation.

## 🚀 Features

- **AI-Powered Search**: Natural language CPU search using trained machine learning models
- **Price Comparison**: Compare prices across multiple vendors (Star Tech, Techland BD, Ultra Tech, Skyland)
- **Product Details**: Comprehensive product information with descriptions and specifications
- **Vendor Logos**: Visual vendor identification with proper branding
- **Responsive Design**: Mobile-first design with Tailwind CSS

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, SQLite
- **AI/ML**: Python scikit-learn models for product recognition
- **Deployment**: Docker, Docker Compose

## 📁 Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes (products, search, admin, vendor, scrapers)
│   ├── admin/             # Admin dashboard and management
│   ├── products/          # Product listing and detail pages (by category)
│   ├── builder/           # PC Builder
│   ├── compare/           # Price comparison
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # UI components (Header, Footer, Hero, ProductCard)
│   ├── features/         # Feature components (CategoryShowcase, SimilarProducts)
│   └── admin/            # Admin components
├── lib/                  # Utilities and types
│   ├── ai/              # AI category models
│   ├── types.ts         # TypeScript type definitions
│   └── utils.ts         # Utility functions
├── public/              # Static assets
│   └── assets/          # Vendor logos
└── cpu_products.db      # SQLite database (if used)
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd BuySmarter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env.local
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Build and start the application
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

### Using Docker

```bash
# Build the image
docker build -t buysmarter-cpu .

# Run the container
docker run -p 3000:3000 -v $(pwd)/cpu_products.db:/app/cpu_products.db buysmarter-cpu
```

## 📊 Database

The application uses SQLite with the following key tables:

- **cpu_products**: Main product data with vendor information, prices, and descriptions
- **Vendor logos**: Stored in `/public/assets/` directory

## 🤖 AI Features

The application includes a trained machine learning model for CPU product recognition:

- **Model**: Random Forest Classifier with TF-IDF vectorization
- **Accuracy**: 58.49% on product recognition
- **Features**: 20+ custom features including brand detection, technical specs, and text patterns
- **Training Data**: 528 CPU products from cleaned database

## 🔧 API Endpoints

- `GET /api/products` - List products (optional category filter)
- `GET /api/products/[category]/[id]` - Get product details by category and id
- `POST /api/search/query` - AI-powered product search
- `GET /api/scrapers` - List vendors (admin scrapers)
- Admin and vendor auth/management routes under `/api/admin/` and `/api/vendor/`

## 🎨 Customization

### Adding New Vendors

1. Add vendor logo to `/public/assets/`
2. Update vendor mapping in `/lib/utils.ts`
3. Update vendor display names

### Styling

The application uses Tailwind CSS. Key configuration files:
- `tailwind.config.js` - Tailwind configuration
- `app/globals.css` - Global styles

## 📝 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For support or questions, please open an issue in the repository.