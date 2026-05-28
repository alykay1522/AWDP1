import React, { useState, useEffect } from 'react';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/products');
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProduct = async (product) => {
    try {
      const method = product.id ? 'PUT' : 'POST';
      const url = product.id ? `/api/products/${product.id}` : '/api/products';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });

      if (response.ok) {
        setEditingProduct(null);
        loadProducts();
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.error || 'Failed to save product');
      }
    } catch (error) {
      alert('Failed to save product');
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return;

    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      loadProducts();
    } catch (error) {
      alert('Failed to delete product');
    }
  };

  if (loading) return <div className="p-8">Loading products...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Products ({products.length})</h1>
        <button 
          onClick={() => setEditingProduct({ name: '', price: 0, category: '' })}
          className="bg-blue-600 text-white px-6 py-2 rounded-xl"
        >
          + Add New Product
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-4">Product</th>
              <th className="text-left p-4">Category</th>
              <th className="text-right p-4">Price</th>
              <th className="text-right p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr key={product.id} className="border-t hover:bg-gray-50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {product.image && (
                      <img src={product.image} alt="" className="w-12 h-12 object-cover rounded" />
                    )}
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-gray-500">{product.part_number}</p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-sm text-gray-600">{product.category}</td>
                <td className="p-4 text-right font-semibold">${product.price}</td>
                <td className="p-4 text-right">
                  <button 
                    onClick={() => setEditingProduct(product)}
                    className="text-blue-600 hover:text-blue-700 px-3 py-1"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => deleteProduct(product.id)}
                    className="text-red-600 hover:text-red-700 px-3 py-1"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-2xl">
            <h3 className="text-2xl font-bold mb-6">
              {editingProduct.id ? 'Edit Product' : 'Add New Product'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Product Name</label>
                <input 
                  type="text" 
                  id="product-name"
                  name="name"
                  value={editingProduct.name || ''}
                  onChange={(e) => setEditingProduct({...editingProduct, name: e.target.value})}
                  className="w-full border rounded-xl px-4 py-3"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Price</label>
                  <input 
                    type="number" 
                    id="product-price"
                    name="price"
                    value={editingProduct.price || ''}
                    onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})}
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <input 
                    type="text" 
                    id="product-category"
                    name="category"
                    value={editingProduct.category || ''}
                    onChange={(e) => setEditingProduct({...editingProduct, category: e.target.value})}
                    className="w-full border rounded-xl px-4 py-3"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea 
                  id="product-description"
                  name="description"
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({...editingProduct, description: e.target.value})}
                  className="w-full border rounded-xl px-4 py-3 h-32"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setEditingProduct(null)}
                className="flex-1 py-3 border rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button 
                onClick={() => saveProduct(editingProduct)}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold"
              >
                {editingProduct.id ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
