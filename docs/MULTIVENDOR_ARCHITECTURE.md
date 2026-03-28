# Multivendor Architecture Plan

## Overview
This document outlines the architecture for transforming BuySmarter into a multivendor platform with role-based access control.

## User Roles

### 1. Superadmin
**Purpose**: Platform administrators with full system access

**Features & Access**:
- ✅ **Dashboard**: Platform-wide overview with all vendors' statistics
- ✅ **Vendor Management**: Approve/reject vendor applications, manage vendor accounts
- ✅ **Bulk Scraper**: Run scrapers for all vendors
- ✅ **Statistics**: Platform-wide analytics and insights
- ✅ **Products**: View and manage all products from all vendors
- ✅ **History**: View all scraping history across all vendors
- ✅ **Database**: Full database access and management
- ✅ **Settings**: Platform settings and configuration

**Menu Structure**:
```
- Dashboard
- Vendor Management (NEW)
- Bulk Scraper
- Statistics
- Products
- History
- Database
- Settings
```

### 2. Vendor Admin
**Purpose**: Individual vendor account managers with limited access to their own data

**Features & Access**:
- ✅ **Dashboard**: Vendor-specific overview with their products' statistics
- ✅ **My Products**: View and manage only their own products
- ✅ **Product Management**: Add, edit, delete their products
- ✅ **Statistics**: Vendor-specific analytics (their products only)
- ✅ **Settings**: Vendor profile settings (website, contact info, etc.)

**Menu Structure**:
```
- Dashboard
- My Products
- Statistics
- Settings
```

**Restricted Access**:
- ❌ Cannot access Bulk Scraper
- ❌ Cannot access History (all vendors)
- ❌ Cannot access Database viewer
- ❌ Cannot access Vendor Management
- ❌ Cannot see other vendors' products

## Database Schema

### vendors Table
```sql
CREATE TABLE vendors (
  id SERIAL PRIMARY KEY,
  vendor_name VARCHAR(255) UNIQUE NOT NULL,
  website_url VARCHAR(500),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  contact_person VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, suspended
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  approved_at TIMESTAMP,
  approved_by INTEGER REFERENCES admin_users(id)
);
```

### vendor_applications Table
```sql
CREATE TABLE vendor_applications (
  id SERIAL PRIMARY KEY,
  vendor_name VARCHAR(255) NOT NULL,
  website_url VARCHAR(500),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  contact_person VARCHAR(255),
  additional_details TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP,
  reviewed_by INTEGER REFERENCES admin_users(id),
  notes TEXT
);
```

### admin_users Table (Updated)
```sql
ALTER TABLE admin_users ADD COLUMN role VARCHAR(50) DEFAULT 'superadmin';
ALTER TABLE admin_users ADD COLUMN vendor_id INTEGER REFERENCES vendors(id);
-- role: 'superadmin' or 'vendor'
-- vendor_id: NULL for superadmin, vendor ID for vendor admins
```

## Vendor Application Flow

1. **Application Submission**:
   - Vendor fills out application form on homepage
   - Form includes: website name, website URL, email, phone, contact person, additional details
   - Application stored in `vendor_applications` table with status 'pending'

2. **Superadmin Review**:
   - Superadmin sees pending applications in Vendor Management
   - Can approve or reject applications
   - On approval: Creates vendor record and optionally creates vendor admin account

3. **Vendor Onboarding**:
   - Approved vendor receives credentials (if admin account created)
   - Vendor can log in and manage their products

## Feature Mapping

### Current Features → Role Assignment

| Feature | Superadmin | Vendor Admin |
|---------|-----------|--------------|
| Dashboard | ✅ (All vendors) | ✅ (Own products only) |
| Bulk Scraper | ✅ | ❌ |
| Statistics | ✅ (Platform-wide) | ✅ (Own products only) |
| Products | ✅ (All products) | ✅ (Own products only) |
| History | ✅ (All vendors) | ❌ |
| Database | ✅ | ❌ |
| Vendor Management | ✅ | ❌ |
| Settings | ✅ (Platform) | ✅ (Profile) |

## Implementation Steps

1. ✅ Create database schema for vendors and vendor_applications
2. ✅ Update admin_users table to support roles
3. ✅ Create vendor application form (modal)
4. ✅ Add vendor application section to homepage
5. ✅ Create API endpoints for vendor applications
6. ✅ Update authentication to support role-based access
7. ✅ Create Vendor Management page for superadmin
8. ✅ Update AdminLayout to show role-based menus
9. ✅ Filter products/statistics by vendor_id for vendor admins
10. ✅ Create vendor admin dashboard

## Security Considerations

- Vendor admins can only access their own data (filtered by vendor_id)
- All API endpoints must check user role and vendor_id
- Superadmin can override any restrictions
- Vendor applications require superadmin approval
- Session management includes role and vendor_id

