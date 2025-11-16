import type { StockComponents } from "@mizpos/api";
import { IconEdit, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { getAuthenticatedClients } from "../lib/api";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/products")({
  component: ProductsPage,
});

interface Product {
  product_id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  image_url: string;
  author: string;
  publisher: string;
  publisher_id?: string;
  variant_type: "physical" | "digital" | "both";
  isdn?: string;
  download_url?: string;
  stock_quantity: number;
  is_active: boolean;
}

type CreateProductForm = StockComponents["schemas"]["CreateProductRequest"] & {
  publisher_id?: string;
  isdn?: string;
  download_url?: string;
};

function ProductsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const initialFormState: CreateProductForm = {
    name: "",
    description: "",
    category: "",
    price: 0,
    image_url: "",
    author: "",
    publisher: "",
    publisher_id: "",
    variant_type: "physical",
    isdn: "",
    download_url: "",
    stock_quantity: 0,
    operator_id: user?.userId || "",
  };

  const [formData, setFormData] = useState<CreateProductForm>(initialFormState);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { stock } = await getAuthenticatedClients();
      const { data, error } = await stock.GET("/products");
      if (error) throw error;
      // APIは { products: [...] } 形式で返す
      const response = data as unknown as { products: Product[] };
      return response.products || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateProductForm) => {
      const { stock } = await getAuthenticatedClients();
      const { error } = await stock.POST("/products", { body: data });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setIsCreateModalOpen(false);
      setFormData(initialFormState);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Product> }) => {
      const { stock } = await getAuthenticatedClients();
      const { error } = await stock.PUT("/products/{product_id}", {
        params: { path: { product_id: id } },
        body: data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditProduct(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { stock } = await getAuthenticatedClients();
      const { error } = await stock.DELETE("/products/{product_id}", {
        params: { path: { product_id: id } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns = [
    { key: "name", header: "商品名" },
    { key: "category", header: "カテゴリ" },
    {
      key: "price",
      header: "価格",
      render: (item: Product) => `¥${item.price.toLocaleString()}`,
    },
    {
      key: "stock_quantity",
      header: "在庫数",
      render: (item: Product) => item.stock_quantity,
    },
    {
      key: "is_active",
      header: "状態",
      render: (item: Product) => (
        <span
          className={css({
            display: "inline-flex",
            paddingX: "2",
            paddingY: "0.5",
            borderRadius: "full",
            fontSize: "xs",
            fontWeight: "medium",
            backgroundColor: item.is_active ? "green.100" : "gray.100",
            color: item.is_active ? "green.800" : "gray.800",
          })}
        >
          {item.is_active ? "有効" : "無効"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "操作",
      render: (item: Product) => (
        <div
          className={css({
            display: "flex",
            gap: "1",
          })}
        >
          <Button variant="ghost" size="sm" onClick={() => setEditProduct(item)}>
            <IconEdit size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (window.confirm(`「${item.name}」を削除しますか？`)) {
                deleteMutation.mutate(item.product_id);
              }
            }}
          >
            <IconTrash size={16} />
          </Button>
        </div>
      ),
    },
  ];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editProduct) {
      updateMutation.mutate({
        id: editProduct.product_id,
        data: editProduct,
      });
    }
  };

  return (
    <>
      <Header title="商品管理" />
      <div
        className={css({
          flex: "1",
          padding: "6",
          overflowY: "auto",
        })}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6",
          })}
        >
          <div
            className={css({
              position: "relative",
              width: "320px",
            })}
          >
            <IconSearch
              size={18}
              className={css({
                position: "absolute",
                left: "3",
                top: "50%",
                transform: "translateY(-50%)",
                color: "gray.400",
              })}
            />
            <input
              type="text"
              placeholder="商品名・カテゴリで検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={css({
                width: "100%",
                paddingLeft: "10",
                paddingRight: "4",
                paddingY: "2",
                borderRadius: "md",
                border: "1px solid",
                borderColor: "gray.300",
                fontSize: "sm",
                _focus: {
                  outline: "none",
                  borderColor: "primary.500",
                  boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                },
              })}
            />
          </div>

          <Button onClick={() => setIsCreateModalOpen(true)}>
            <IconPlus size={18} />
            商品追加
          </Button>
        </div>

        {isLoading ? (
          <div
            className={css({
              textAlign: "center",
              padding: "8",
              color: "gray.500",
            })}
          >
            読み込み中...
          </div>
        ) : (
          <Table
            columns={columns}
            data={filteredProducts}
            keyExtractor={(item) => item.product_id}
            emptyMessage="商品が見つかりません"
          />
        )}
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setFormData(initialFormState);
        }}
        title="商品追加"
      >
        <form onSubmit={handleCreateSubmit}>
          <ProductForm
            data={formData}
            onChange={setFormData}
            isNew
          />
          <div
            className={css({
              display: "flex",
              justifyContent: "flex-end",
              gap: "2",
              marginTop: "4",
            })}
          >
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                setFormData(initialFormState);
              }}
              type="button"
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "作成中..." : "作成"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editProduct}
        onClose={() => setEditProduct(null)}
        title="商品編集"
      >
        {editProduct && (
          <form onSubmit={handleUpdateSubmit}>
            <ProductForm
              data={editProduct}
              onChange={(updated) => setEditProduct({ ...editProduct, ...updated })}
              isNew={false}
            />
            <div
              className={css({
                display: "flex",
                justifyContent: "flex-end",
                gap: "2",
                marginTop: "4",
              })}
            >
              <Button variant="secondary" onClick={() => setEditProduct(null)} type="button">
                キャンセル
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "更新中..." : "更新"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

interface Publisher {
  publisher_id: string;
  name: string;
  description: string;
  contact_name: string;
  contact_email: string;
  commission_rate: number;
}

interface ProductFormProps {
  data: CreateProductForm | Product;
  onChange: (data: CreateProductForm | Product) => void;
  isNew: boolean;
}

function ProductForm({ data, onChange, isNew }: ProductFormProps) {
  const { data: publishers = [] } = useQuery({
    queryKey: ["publishers"],
    queryFn: async () => {
      const { stock } = await getAuthenticatedClients();
      const { data, error } = await stock.GET("/publishers");
      if (error) throw error;
      const response = data as unknown as { publishers: Publisher[] };
      return response.publishers || [];
    },
  });

  const inputClass = css({
    width: "100%",
    padding: "2",
    borderRadius: "md",
    border: "1px solid",
    borderColor: "gray.300",
    fontSize: "sm",
    _focus: {
      outline: "none",
      borderColor: "primary.500",
    },
  });

  const labelClass = css({
    display: "block",
    fontSize: "sm",
    fontWeight: "medium",
    color: "gray.700",
    marginBottom: "1",
  });

  return (
    <div
      className={css({
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "4",
      })}
    >
      <div className={css({ gridColumn: "span 2" })}>
        <label htmlFor="name" className={labelClass}>
          商品名 *
        </label>
        <input
          id="name"
          type="text"
          required
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="category" className={labelClass}>
          カテゴリ *
        </label>
        <input
          id="category"
          type="text"
          required
          value={data.category}
          onChange={(e) => onChange({ ...data, category: e.target.value })}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="price" className={labelClass}>
          価格 *
        </label>
        <input
          id="price"
          type="number"
          required
          min="0"
          value={data.price}
          onChange={(e) => onChange({ ...data, price: parseInt(e.target.value, 10) || 0 })}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="variant_type" className={labelClass}>
          タイプ
        </label>
        <select
          id="variant_type"
          value={data.variant_type}
          onChange={(e) =>
            onChange({
              ...data,
              variant_type: e.target.value as "physical" | "digital" | "both",
            })
          }
          className={inputClass}
        >
          <option value="physical">物理商品</option>
          <option value="digital">デジタル商品</option>
          <option value="both">両方</option>
        </select>
      </div>

      {isNew && (
        <div>
          <label htmlFor="stock_quantity" className={labelClass}>
            初期在庫数
          </label>
          <input
            id="stock_quantity"
            type="number"
            min="0"
            value={(data as CreateProductForm).stock_quantity}
            onChange={(e) =>
              onChange({
                ...data,
                stock_quantity: parseInt(e.target.value, 10) || 0,
              } as CreateProductForm)
            }
            className={inputClass}
          />
        </div>
      )}

      <div className={css({ gridColumn: "span 2" })}>
        <label htmlFor="description" className={labelClass}>
          説明
        </label>
        <textarea
          id="description"
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          rows={3}
          className={`${inputClass} ${css({ resize: "vertical" })}`}
        />
      </div>

      <div>
        <label htmlFor="author" className={labelClass}>
          著者
        </label>
        <input
          id="author"
          type="text"
          value={data.author}
          onChange={(e) => onChange({ ...data, author: e.target.value })}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="publisher" className={labelClass}>
          出版社名
        </label>
        <input
          id="publisher"
          type="text"
          value={data.publisher}
          onChange={(e) => onChange({ ...data, publisher: e.target.value })}
          className={inputClass}
        />
      </div>

      <div className={css({ gridColumn: "span 2" })}>
        <label htmlFor="publisher_id" className={labelClass}>
          サークル (委託販売用)
        </label>
        <select
          id="publisher_id"
          value={(data as CreateProductForm).publisher_id || ""}
          onChange={(e) => onChange({ ...data, publisher_id: e.target.value })}
          className={inputClass}
        >
          <option value="">-- 選択してください --</option>
          {publishers.map((publisher) => (
            <option key={publisher.publisher_id} value={publisher.publisher_id}>
              {publisher.name} (手数料: {publisher.commission_rate}%)
            </option>
          ))}
        </select>
        <p className={css({ fontSize: "xs", color: "gray.500", marginTop: "1" })}>
          委託販売の手数料計算に使用されます
        </p>
      </div>

      <div>
        <label htmlFor="isdn" className={labelClass}>
          ISDN (国際標準同人誌番号)
        </label>
        <input
          id="isdn"
          type="text"
          value={(data as CreateProductForm).isdn || ""}
          onChange={(e) => onChange({ ...data, isdn: e.target.value })}
          className={inputClass}
          placeholder="278-4-xxx-xxxxx-x"
        />
      </div>

      <div>
        <label htmlFor="download_url" className={labelClass}>
          ダウンロードURL
        </label>
        <input
          id="download_url"
          type="url"
          value={(data as CreateProductForm).download_url || ""}
          onChange={(e) => onChange({ ...data, download_url: e.target.value })}
          className={inputClass}
          placeholder="https://..."
        />
      </div>

      <div className={css({ gridColumn: "span 2" })}>
        <label htmlFor="image_url" className={labelClass}>
          画像URL
        </label>
        <input
          id="image_url"
          type="url"
          value={data.image_url}
          onChange={(e) => onChange({ ...data, image_url: e.target.value })}
          className={inputClass}
        />
      </div>
    </div>
  );
}
