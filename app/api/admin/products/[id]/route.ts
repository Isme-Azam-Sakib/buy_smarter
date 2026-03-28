import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getDatabase } from '@/lib/database'
import { hasPermission } from '@/lib/admin-permissions'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await requireAdmin()
  if (!hasPermission(session, 'products.edit')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Handle both Promise and direct params (Next.js 13+ compatibility)
  const resolvedParams = 'then' in params ? await params : params
  const productId = resolvedParams.id

  if (!productId) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
  }

  const body = await request.json()
  console.log('Update request for product ID:', productId)
  console.log('Request body:', JSON.stringify(body, null, 2))
  
  const allowedFields = [
    'vendor_name',
    'category',
    'standard_name',
    'brand',
    'price_bdt',
    'availability_status',
    'product_url',
    'image_url',
    'description',
  ]
  const updates = allowedFields
    .filter((field) => body[field] !== undefined)
    .map((field) => `${field} = ?`)

  if (!updates.length) {
    console.error('No fields to update')
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const paramsList = allowedFields
    .filter((field) => body[field] !== undefined)
    .map((field) => body[field])
  
  console.log('Fields to update:', updates)
  console.log('Update values:', paramsList)

  // Tokenized name is the same as standard_name, just split into words
  const { extractTokenizedName } = await import('@/lib/tokenize-name')
  const tokenized = body.standard_name
    ? extractTokenizedName(body.standard_name, body.category || 'processor')
    : null

  const db = await getDatabase()
  try {
    // Check if vendor user can edit this product
    if (session.role === 'vendor') {
      const product = await db.get(
        `SELECT vendor_name FROM all_products WHERE id = ?`,
        [productId]
      ) as { vendor_name: string } | undefined
      
      if (!product) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
      
      // Check if vendor has managed_vendor_name and if it matches
      if (session.managedVendorName) {
        if (product.vendor_name !== session.managedVendorName) {
          return NextResponse.json(
            { error: 'You can only edit products from your assigned vendor store' },
            { status: 403 }
          )
        }
      } else {
        // Check if product belongs to vendor's own store
        const { getVendorByAdminUserId } = await import('@/lib/vendor-db')
        const vendorRecord = await getVendorByAdminUserId(session.userId)
        if (product.vendor_name !== vendorRecord?.vendor_name) {
          return NextResponse.json(
            { error: 'You can only edit products from your own vendor store' },
            { status: 403 }
          )
        }
      }
    }
    
    const extraClause = tokenized ? ', tokenized_name = ?' : ''
    if (tokenized) {
      paramsList.push(tokenized)
    }
    paramsList.push(new Date().toISOString(), productId)
    
    const updateSQL = `
      UPDATE all_products
      SET ${updates.join(', ')}${extraClause}, updated_at = ?
      WHERE id = ?
    `
    console.log('Executing SQL:', updateSQL)
    console.log('With params:', paramsList)
    
    const result = await db.run(updateSQL, paramsList)
    
    console.log('Update result:', result)
    
    if (result.changes === 0) {
      console.warn('No rows updated for product ID:', productId)
      return NextResponse.json({ error: 'Product not found or no changes made' }, { status: 404 })
    }
    
    console.log('Product updated successfully, changes:', result.changes)
    return NextResponse.json({ success: true, message: 'Product updated successfully', changes: result.changes })
  } catch (error: any) {
    console.error('Product update error', error)
    return NextResponse.json(
      { error: error.message || 'Unable to update product' },
      { status: 500 }
    )
  } finally {
    await db.close()
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await requireAdmin()
  if (!hasPermission(session, 'products.delete')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Handle both Promise and direct params (Next.js 13+ compatibility)
  const resolvedParams = 'then' in params ? await params : params
  const productId = resolvedParams.id

  if (!productId) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
  }

  const db = await getDatabase()
  try {
    const result = await db.run(
      `DELETE FROM all_products WHERE id = ?`,
      [productId]
    )
    
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    return NextResponse.json({ success: true, message: 'Product deleted successfully' })
  } catch (error: any) {
    console.error('Product delete error', error)
    return NextResponse.json(
      { error: error.message || 'Unable to delete product' },
      { status: 500 }
    )
  } finally {
    await db.close()
  }
}

