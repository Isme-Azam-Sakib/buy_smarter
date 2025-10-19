// Simple test to check if the API is working
fetch('http://localhost:3000/api/products?limit=5')
  .then(response => response.json())
  .then(data => {
    console.log('API Response:', data);
    if (data.products && data.products.length > 0) {
      console.log('✅ API is working! Found', data.products.length, 'products');
      console.log('Sample product:', data.products[0].standardName);
    } else {
      console.log('❌ No products found');
    }
  })
  .catch(error => {
    console.error('❌ API Error:', error);
  });
