import { IconAdjustments, IconPlus, IconSearch } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { stock } from "../lib/api";

export const Route = createFileRoute("/stock")({
  component: StockPage,
});

interface Product {
  product_id: string;
  name: string;
  category: string;
  price: number;
  stock_quantity: number;
  variant_type: "physical" | "digital" | "both";
  is_active: boolean;
}

interface AdjustmentForm {
  productId: string;
  productName: string;
  currentStock: number;
  quantityChange: number;
  reason: string;
}

function StockPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [adjustmentModal, setAdjustmentModal] = useState<AdjustmentForm | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await stock.GET("/products");
      if (error) throw error;
      return (data as unknown as Product[]) || [];
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: async (form: AdjustmentForm) => {
      const { error } = await stock.POST("/products/{product_id}/adjust", {
        params: { path: { product_id: form.productId } },
        body: {
          quantity_change: form.quantityChange,
          reason: form.reason,
          operator_id: "admin",
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setAdjustmentModal(null);
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
      render: (item: Product) => (
        <span
          className={css({
            fontWeight: "semibold",
            color: item.stock_quantity <= 5 ? "error" : "gray.900",
          })}
        >
          {item.stock_quantity}
          {item.stock_quantity <= 5 && (
            <span
              className={css({
                marginLeft: "2",
                fontSize: "xs",
                color: "error",
              })}
            >
              (在庫少)
            </span>
          )}
        </span>
      ),
    },
    {
      key: "variant_type",
      header: "タイプ",
      render: (item: Product) => {
        const labels = {
          physical: "物理",
          digital: "デジタル",
          both: "両方",
        };
        return labels[item.variant_type];
      },
    },
    {
      key: "actions",
      header: "操作",
      render: (item: Product) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setAdjustmentModal({
              productId: item.product_id,
              productName: item.name,
              currentStock: item.stock_quantity,
              quantityChange: 0,
              reason: "",
            })
          }
        >
          <IconAdjustments size={16} />
          調整
        </Button>
      ),
    },
  ];

  return (
    <>
      <Header title="在庫管理" />
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

          <Button>
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

      <Modal
        isOpen={!!adjustmentModal}
        onClose={() => setAdjustmentModal(null)}
        title="在庫調整"
      >
        {adjustmentModal && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              adjustStockMutation.mutate(adjustmentModal);
            }}
          >
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "4",
              })}
            >
              <div>
                <label
                  className={css({
                    display: "block",
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "gray.700",
                    marginBottom: "1",
                  })}
                >
                  商品名
                </label>
                <p
                  className={css({
                    fontSize: "sm",
                    color: "gray.900",
                  })}
                >
                  {adjustmentModal.productName}
                </p>
              </div>

              <div>
                <label
                  className={css({
                    display: "block",
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "gray.700",
                    marginBottom: "1",
                  })}
                >
                  現在の在庫数
                </label>
                <p
                  className={css({
                    fontSize: "sm",
                    color: "gray.900",
                  })}
                >
                  {adjustmentModal.currentStock}
                </p>
              </div>

              <div>
                <label
                  htmlFor="quantityChange"
                  className={css({
                    display: "block",
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "gray.700",
                    marginBottom: "1",
                  })}
                >
                  数量変更 (正: 入庫, 負: 出庫)
                </label>
                <input
                  id="quantityChange"
                  type="number"
                  value={adjustmentModal.quantityChange}
                  onChange={(e) =>
                    setAdjustmentModal({
                      ...adjustmentModal,
                      quantityChange: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className={css({
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
                  })}
                />
              </div>

              <div>
                <label
                  htmlFor="reason"
                  className={css({
                    display: "block",
                    fontSize: "sm",
                    fontWeight: "medium",
                    color: "gray.700",
                    marginBottom: "1",
                  })}
                >
                  調整理由
                </label>
                <textarea
                  id="reason"
                  value={adjustmentModal.reason}
                  onChange={(e) =>
                    setAdjustmentModal({
                      ...adjustmentModal,
                      reason: e.target.value,
                    })
                  }
                  rows={3}
                  className={css({
                    width: "100%",
                    padding: "2",
                    borderRadius: "md",
                    border: "1px solid",
                    borderColor: "gray.300",
                    fontSize: "sm",
                    resize: "vertical",
                    _focus: {
                      outline: "none",
                      borderColor: "primary.500",
                    },
                  })}
                />
              </div>

              <div
                className={css({
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "2",
                  marginTop: "2",
                })}
              >
                <Button
                  variant="secondary"
                  onClick={() => setAdjustmentModal(null)}
                  type="button"
                >
                  キャンセル
                </Button>
                <Button
                  type="submit"
                  disabled={
                    adjustmentModal.quantityChange === 0 ||
                    !adjustmentModal.reason ||
                    adjustStockMutation.isPending
                  }
                >
                  {adjustStockMutation.isPending ? "処理中..." : "調整を実行"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
