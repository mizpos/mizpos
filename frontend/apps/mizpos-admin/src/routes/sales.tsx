import { IconEye, IconSearch, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { Modal } from "../components/Modal";
import { Table } from "../components/Table";
import { getAuthenticatedClients } from "../lib/api";

export const Route = createFileRoute("/sales")({
  component: SalesPage,
});

interface SaleItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Sale {
  sale_id: string;
  event_id: string;
  user_id: string;
  items: SaleItem[];
  total_amount: number;
  discount_amount: number;
  final_amount: number;
  payment_method: "stripe_online" | "stripe_terminal" | "cash";
  status: "pending" | "completed" | "cancelled";
  coupon_code?: string;
  customer_email?: string;
  created_at: string;
  completed_at?: string;
}

function SalesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const { data: salesData = [], isLoading } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { sales } = await getAuthenticatedClients();
      const { data, error } = await sales.GET("/sales", {
        params: { query: { limit: 100 } },
      });
      if (error) throw error;
      // APIは { sales: [...] } 形式で返す
      const response = data as unknown as { sales: Sale[] };
      return response.sales || [];
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (saleId: string) => {
      const { sales } = await getAuthenticatedClients();
      const { error } = await sales.POST("/sales/{sale_id}/cancel", {
        params: { path: { sale_id: saleId } },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setSelectedSale(null);
    },
  });

  const filteredSales = salesData.filter(
    (sale) =>
      sale.sale_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.user_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ??
        false),
  );

  const getStatusBadge = (status: Sale["status"]) => {
    const styles = {
      pending: {
        backgroundColor: "yellow.100",
        color: "yellow.800",
        label: "処理中",
      },
      completed: {
        backgroundColor: "green.100",
        color: "green.800",
        label: "完了",
      },
      cancelled: {
        backgroundColor: "red.100",
        color: "red.800",
        label: "キャンセル",
      },
    };
    const style = styles[status];

    return (
      <span
        className={css({
          display: "inline-flex",
          paddingX: "2",
          paddingY: "0.5",
          borderRadius: "full",
          fontSize: "xs",
          fontWeight: "medium",
          backgroundColor: style.backgroundColor,
          color: style.color,
        })}
      >
        {style.label}
      </span>
    );
  };

  const getPaymentMethodLabel = (method: Sale["payment_method"]) => {
    const labels = {
      stripe_online: "オンライン決済",
      stripe_terminal: "端末決済",
      cash: "現金",
    };
    return labels[method];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns = [
    {
      key: "sale_id",
      header: "注文ID",
      render: (item: Sale) => (
        <span className={css({ fontFamily: "monospace", fontSize: "xs" })}>
          {item.sale_id.slice(0, 8)}...
        </span>
      ),
    },
    {
      key: "created_at",
      header: "日時",
      render: (item: Sale) => formatDate(item.created_at),
    },
    {
      key: "items",
      header: "商品数",
      render: (item: Sale) => `${item.items.length}点`,
    },
    {
      key: "final_amount",
      header: "合計金額",
      render: (item: Sale) => `¥${item.final_amount.toLocaleString()}`,
    },
    {
      key: "payment_method",
      header: "決済方法",
      render: (item: Sale) => getPaymentMethodLabel(item.payment_method),
    },
    {
      key: "status",
      header: "状態",
      render: (item: Sale) => getStatusBadge(item.status),
    },
    {
      key: "actions",
      header: "操作",
      render: (item: Sale) => (
        <Button variant="ghost" size="sm" onClick={() => setSelectedSale(item)}>
          <IconEye size={16} />
          詳細
        </Button>
      ),
    },
  ];

  const totalRevenue = filteredSales
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + s.final_amount, 0);

  const totalOrders = filteredSales.filter(
    (s) => s.status === "completed",
  ).length;

  return (
    <>
      <Header title="売上管理" />
      <div
        className={css({
          flex: "1",
          padding: "6",
          overflowY: "auto",
        })}
      >
        {/* Summary Cards */}
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "4",
            marginBottom: "6",
          })}
        >
          <div
            className={css({
              backgroundColor: "white",
              padding: "4",
              borderRadius: "lg",
              border: "1px solid",
              borderColor: "gray.200",
            })}
          >
            <p className={css({ fontSize: "sm", color: "gray.500" })}>総売上</p>
            <p
              className={css({
                fontSize: "2xl",
                fontWeight: "bold",
                color: "gray.900",
              })}
            >
              ¥{totalRevenue.toLocaleString()}
            </p>
          </div>
          <div
            className={css({
              backgroundColor: "white",
              padding: "4",
              borderRadius: "lg",
              border: "1px solid",
              borderColor: "gray.200",
            })}
          >
            <p className={css({ fontSize: "sm", color: "gray.500" })}>注文数</p>
            <p
              className={css({
                fontSize: "2xl",
                fontWeight: "bold",
                color: "gray.900",
              })}
            >
              {totalOrders}件
            </p>
          </div>
          <div
            className={css({
              backgroundColor: "white",
              padding: "4",
              borderRadius: "lg",
              border: "1px solid",
              borderColor: "gray.200",
            })}
          >
            <p className={css({ fontSize: "sm", color: "gray.500" })}>
              平均注文額
            </p>
            <p
              className={css({
                fontSize: "2xl",
                fontWeight: "bold",
                color: "gray.900",
              })}
            >
              ¥
              {totalOrders > 0
                ? Math.round(totalRevenue / totalOrders).toLocaleString()
                : 0}
            </p>
          </div>
        </div>

        {/* Search */}
        <div
          className={css({
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
              placeholder="注文ID・ユーザーID・メールで検索..."
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
        </div>

        {/* Table */}
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
            data={filteredSales}
            keyExtractor={(item) => item.sale_id}
            emptyMessage="売上データがありません"
          />
        )}
      </div>

      {/* Sale Detail Modal */}
      <Modal
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        title="売上詳細"
      >
        {selectedSale && (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "4",
            })}
          >
            <div
              className={css({
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "4",
              })}
            >
              <div>
                <p
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginBottom: "1",
                  })}
                >
                  注文ID
                </p>
                <p className={css({ fontSize: "sm", fontFamily: "monospace" })}>
                  {selectedSale.sale_id}
                </p>
              </div>
              <div>
                <p
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginBottom: "1",
                  })}
                >
                  状態
                </p>
                {getStatusBadge(selectedSale.status)}
              </div>
              <div>
                <p
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginBottom: "1",
                  })}
                >
                  作成日時
                </p>
                <p className={css({ fontSize: "sm" })}>
                  {formatDate(selectedSale.created_at)}
                </p>
              </div>
              <div>
                <p
                  className={css({
                    fontSize: "xs",
                    color: "gray.500",
                    marginBottom: "1",
                  })}
                >
                  決済方法
                </p>
                <p className={css({ fontSize: "sm" })}>
                  {getPaymentMethodLabel(selectedSale.payment_method)}
                </p>
              </div>
              {selectedSale.customer_email && (
                <div className={css({ gridColumn: "span 2" })}>
                  <p
                    className={css({
                      fontSize: "xs",
                      color: "gray.500",
                      marginBottom: "1",
                    })}
                  >
                    顧客メール
                  </p>
                  <p className={css({ fontSize: "sm" })}>
                    {selectedSale.customer_email}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p
                className={css({
                  fontSize: "sm",
                  fontWeight: "semibold",
                  marginBottom: "2",
                })}
              >
                購入商品
              </p>
              <div
                className={css({
                  border: "1px solid",
                  borderColor: "gray.200",
                  borderRadius: "md",
                  overflow: "hidden",
                })}
              >
                {selectedSale.items.map((item) => (
                  <div
                    key={item.product_id}
                    className={css({
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "3",
                      borderBottom: "1px solid",
                      borderColor: "gray.100",
                      _last: { borderBottom: "none" },
                    })}
                  >
                    <div>
                      <p
                        className={css({
                          fontSize: "sm",
                          fontWeight: "medium",
                        })}
                      >
                        {item.product_name}
                      </p>
                      <p className={css({ fontSize: "xs", color: "gray.500" })}>
                        ¥{item.unit_price.toLocaleString()} × {item.quantity}
                      </p>
                    </div>
                    <p
                      className={css({ fontSize: "sm", fontWeight: "medium" })}
                    >
                      ¥{item.subtotal.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className={css({
                backgroundColor: "gray.50",
                padding: "3",
                borderRadius: "md",
              })}
            >
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "1",
                })}
              >
                <span className={css({ fontSize: "sm", color: "gray.600" })}>
                  小計
                </span>
                <span className={css({ fontSize: "sm" })}>
                  ¥{selectedSale.total_amount.toLocaleString()}
                </span>
              </div>
              {selectedSale.discount_amount > 0 && (
                <div
                  className={css({
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "1",
                  })}
                >
                  <span className={css({ fontSize: "sm", color: "gray.600" })}>
                    割引{" "}
                    {selectedSale.coupon_code &&
                      `(${selectedSale.coupon_code})`}
                  </span>
                  <span className={css({ fontSize: "sm", color: "error" })}>
                    -¥{selectedSale.discount_amount.toLocaleString()}
                  </span>
                </div>
              )}
              <div
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: "bold",
                })}
              >
                <span className={css({ fontSize: "sm" })}>合計</span>
                <span className={css({ fontSize: "lg" })}>
                  ¥{selectedSale.final_amount.toLocaleString()}
                </span>
              </div>
            </div>

            {selectedSale.status === "pending" && (
              <div
                className={css({
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "2",
                })}
              >
                <Button
                  variant="danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        "この注文をキャンセルしますか？在庫が戻ります。",
                      )
                    ) {
                      cancelMutation.mutate(selectedSale.sale_id);
                    }
                  }}
                  disabled={cancelMutation.isPending}
                >
                  <IconX size={16} />
                  {cancelMutation.isPending ? "処理中..." : "キャンセル"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
