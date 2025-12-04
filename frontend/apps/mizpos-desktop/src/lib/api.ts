const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface ApiProduct {
  product_id: string;
  name: string;
  price: number;
  jan_code?: string;
  isbn?: string;
  isdn?: string;
  jan_barcode_1?: string;
  jan_barcode_2?: string;
  category?: string;
  publisher_id?: string;
  publisher_name?: string;
  publisher?: string;
  stock_quantity?: number;
  image_url?: string;
}

interface ProductsResponse {
  products: ApiProduct[];
}

/**
 * 商品一覧を取得
 */
export async function fetchProducts(category?: string): Promise<ApiProduct[]> {
  const url = new URL(`${API_BASE_URL}/stock/products`);
  if (category) {
    url.searchParams.set("category", category);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`);
  }

  const data: ProductsResponse = await response.json();
  return data.products;
}
