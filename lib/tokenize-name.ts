/**
 * Utility functions to extract tokenized_name from raw_name based on category-specific rules
 */

// Category-specific unnecessary words
const cpu_unnecessary_words = [
  'processor', 'cpu', 'with', 'rebox', 'radeon', 'graphics', 'gaming', 'am4', 'am5', '1700',
  'desktop', 'bundle', 'gen', 'generation', 'raptor', 'alder', 'pc', '4th', '5th', '6th',
  '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', 'vega 3', 'socket',
  'vega 11', 'rx', 'lga', 'tray', 'eration', 'threads', 'cores', 'full', 'bulk', 'lga1155',
  '-', 'cooler', 'Quad-Core', 'thread'
]

const unnecessary_words_gpu = [
  'display', 'pcie', 'vga', 'hdmi', 'pci', 'express', 'video', 'output', 'port', 'ports',
  'fan', 'cooled', 'cooling', 'memory', 'graphics', 'card'
]

const cooler_unnecessary_words = [
  'cooler', 'cpu', 'processor', 'liquid', 'all', 'in', 'one', 'sync', 'icue', 'fan', 'led',
  'water', 'high-performance', 'all-in-one', 'link', 'gaming', '-', 'low-profile'
]

const ram_unnecessary_words = [
  'ram', 'desktop', 'gaming', 'u-dimm', 'heatsink', 'with', 'signature', 'line', 'udimm'
]

const power_supply_unnecessary_words = [
  'power', 'supply', 'psu', 'unit', 'watt', 'watts', 'smart', 'real', 'warranty', 'premium',
  'lownoise', 'output', 'certified', 'efficiency', 'certification', 'fan', 'silent', 'cooling',
  'active', 'pfc', 'hydraulic', 'bearing', 'protection', 'ovp', 'opp', 'uvp', 'scp', 'ocp',
  'otp', 'gaming', 'high', 'performance', 'grade', 'series', 'edition', 'model', 'cable',
  'flat', 'rail', 'single', 'dual', 'with', 'for'
]

const ssd_unnecessary_words = [
  'ssd', 'solid', 'state', 'drive', 'disk', 'hard', 'gaming', 'drive', 'portable', 'cache',
  'internal', 'with', 'gaming', 'performance', 'pro', 'ultra', 'lite', 'extreme', 'max',
  'series', 'edition', 'model', 'dram', 'internal', 'external', 'desktop', 'laptop', 'notebook',
  'flash', 'nand', '3d', 'tlc', 'qlc', 'mlc', 'slc', 'heatsink', 'heat', 'shield', 'spreader',
  'rgb', 'argb', 'led', 'lighting', 'save', 'offer', 'bundle', 'promo', 'discount', 'with',
  'for', 'plus'
]

// Map category to unnecessary words
const categoryUnnecessaryWords: Record<string, string[]> = {
  'processor': cpu_unnecessary_words,
  'cpu': cpu_unnecessary_words,
  'graphics-card': unnecessary_words_gpu,
  'gpu': unnecessary_words_gpu,
  'cpu-cooler': cooler_unnecessary_words,
  'cooler': cooler_unnecessary_words,
  'ram': ram_unnecessary_words,
  'power-supply': power_supply_unnecessary_words,
  'psu': power_supply_unnecessary_words,
  'ssd': ssd_unnecessary_words,
  'storage': ssd_unnecessary_words,
}

/**
 * Extract tokenized_name from standard_name.
 * 
 * Tokenized name is the same as standard_name, just split into words as a JSON array.
 * 
 * @param standardName - The standard product name
 * @param category - Product category (not used, kept for compatibility)
 * @returns Tokenized name as JSON array string, e.g., '["geforce", "rtx", "5090", "32g", "gaming", "trio", "oc", "32gb", "gddr7"]'
 */
export function extractTokenizedName(standardName: string, category: string): string {
  if (!standardName || !standardName.trim()) {
    return ''
  }

  // Split standard_name into words and convert to lowercase
  const words = standardName.trim().split(/\s+/).filter(word => word.length > 0)
  const wordsLower = words.map(w => w.toLowerCase())
  
  if (wordsLower.length === 0) {
    return ''
  }
  
  // Return as JSON array string
  return JSON.stringify(wordsLower)
}

/**
 * Update tokenized_name for a product entry based on standard_name
 * 
 * @param db - Database instance
 * @param productId - Product ID to update
 * @param standardName - Standard product name
 * @param category - Product category (not used, kept for compatibility)
 */
export async function updateTokenizedName(
  db: any,
  productId: number | string,
  standardName: string,
  category: string
): Promise<void> {
  const tokenizedName = extractTokenizedName(standardName, category)
  
  if (!tokenizedName) {
    console.warn(`[Tokenize] Empty tokenized_name for product ${productId}, standard_name: "${standardName}"`)
    return
  }

  try {
    await db.run(
      `UPDATE all_products SET tokenized_name = ? WHERE id = ?`,
      [tokenizedName, productId]
    )
    console.log(`[Tokenize] Updated tokenized_name for product ${productId}: "${tokenizedName}"`)
  } catch (error) {
    console.error(`[Tokenize] Error updating tokenized_name for product ${productId}:`, error)
    throw error
  }
}

/**
 * Update tokenized_name for multiple product entries
 * 
 * @param db - Database instance
 * @param products - Array of {id, standard_name, category}
 */
export async function updateTokenizedNameBulk(
  db: any,
  products: Array<{ id: number | string; standard_name: string; category: string }>
): Promise<void> {
  for (const product of products) {
    try {
      await updateTokenizedName(db, product.id, product.standard_name, product.category)
    } catch (error) {
      console.error(`[Tokenize] Error updating product ${product.id}:`, error)
      // Continue with other products
    }
  }
}

