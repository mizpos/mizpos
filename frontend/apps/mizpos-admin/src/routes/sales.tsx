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
  subtotal: number;
  discount: number;
  total: number;
  payment_method: "stripe_online" | "stripe_terminal" | "cash";
  status: "pending" | "completed" | "shipped" | "cancelled";
  coupon_code?: string;
  customer_email?: string;
  customer_name?: string;
  shipping_address?: {
    name: string;
    postal_code: string;
    prefecture: string;
    city: string;
    address_line1: string;
    address_line2?: string;
    phone_number: string;
  };
  tracking_number?: string;
  carrier?: string;
  shipping_notes?: string;
  shipped_at?: string;
  created_at: string;
  completed_at?: string;
}

function SalesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [isShippingFormOpen, setIsShippingFormOpen] = useState(false);
  const [shippingFormData, setShippingFormData] = useState({
    tracking_number: "",
    carrier: "",
    notes: "",
  });

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

  const updateShippingMutation = useMutation({
    mutationFn: async ({
      saleId,
      data,
    }: {
      saleId: string;
      data: { tracking_number?: string; carrier?: string; notes?: string };
    }) => {
      const { sales } = await getAuthenticatedClients();
      const { error } = await sales.POST("/orders/{order_id}/shipping", {
        params: { path: { order_id: saleId } },
        body: data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      setIsShippingFormOpen(false);
      setShippingFormData({ tracking_number: "", carrier: "", notes: "" });
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
      shipped: {
        backgroundColor: "blue.100",
        color: "blue.800",
        label: "発送済み",
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
      render: (item: Sale) => `${(item.items?.length ?? 0)}点`,
    },
    {
      key: "total",
      header: "合計金額",
      render: (item: Sale) => `¥${(item.total ?? 0).toLocaleString()}`,
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
    .reduce((sum, s) => sum + (s.total ?? 0), 0);

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
                {(selectedSale.items ?? []).map((item) => (
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
                        ¥{(item.unit_price ?? 0).toLocaleString()} × {item.quantity ?? 0}
                      </p>
                    </div>
                    <p
                      className={css({ fontSize: "sm", fontWeight: "medium" })}
                    >
                      ¥{(item.subtotal ?? 0).toLocaleString()}
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
                  ¥{(selectedSale.subtotal ?? 0).toLocaleString()}
                </span>
              </div>
              {(selectedSale.discount ?? 0) > 0 && (
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
                    -¥{(selectedSale.discount ?? 0).toLocaleString()}
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
                  ¥{(selectedSale.total ?? 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* 配送先住所 */}
            {selectedSale.shipping_address && (
              <div>
                <p
                  className={css({
                    fontSize: "sm",
                    fontWeight: "semibold",
                    marginBottom: "2",
                  })}
                >
                  配送先
                </p>
                <div
                  className={css({
                    backgroundColor: "gray.50",
                    padding: "3",
                    borderRadius: "md",
                    fontSize: "sm",
                  })}
                >
                  <p>
                    {selectedSale.customer_name ||
                      selectedSale.shipping_address.name}
                  </p>
                  <p>〒{selectedSale.shipping_address.postal_code}</p>
                  <p>
                    {selectedSale.shipping_address.prefecture}{" "}
                    {selectedSale.shipping_address.city}
                  </p>
                  <p>{selectedSale.shipping_address.address_line1}</p>
                  {selectedSale.shipping_address.address_line2 && (
                    <p>{selectedSale.shipping_address.address_line2}</p>
                  )}
                  <p>電話: {selectedSale.shipping_address.phone_number}</p>
                </div>
              </div>
            )}

            {/* 発送情報 */}
            {selectedSale.status === "shipped" &&
              selectedSale.tracking_number && (
                <div>
                  <p
                    className={css({
                      fontSize: "sm",
                      fontWeight: "semibold",
                      marginBottom: "2",
                    })}
                  >
                    発送情報
                  </p>
                  <div
                    className={css({
                      backgroundColor: "blue.50",
                      padding: "3",
                      borderRadius: "md",
                      fontSize: "sm",
                    })}
                  >
                    {selectedSale.carrier && (
                      <p className={css({ marginBottom: "1" })}>
                        <strong>配送業者:</strong> {selectedSale.carrier}
                      </p>
                    )}
                    <p className={css({ marginBottom: "1" })}>
                      <strong>追跡番号:</strong> {selectedSale.tracking_number}
                    </p>
                    {selectedSale.shipped_at && (
                      <p className={css({ marginBottom: "1" })}>
                        <strong>発送日時:</strong>{" "}
                        {formatDate(selectedSale.shipped_at)}
                      </p>
                    )}
                    {selectedSale.shipping_notes && (
                      <p>
                        <strong>備考:</strong> {selectedSale.shipping_notes}
                      </p>
                    )}
                  </div>
                </div>
              )}

            {/* 発送登録フォーム */}
            {isShippingFormOpen && (
              <div>
                <p
                  className={css({
                    fontSize: "sm",
                    fontWeight: "semibold",
                    marginBottom: "2",
                  })}
                >
                  発送情報を登録
                </p>
                <div
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: "3",
                  })}
                >
                  <div>
                    <label htmlFor="shipping-carrier">配送業者</label>
                    <input
                      type="text"
                      id="shipping-carrier"
                      value={shippingFormData.carrier}
                      onChange={(e) =>
                        setShippingFormData({
                          ...shippingFormData,
                          carrier: e.target.value,
                        })
                      }
                      placeholder="例: ヤマト運輸"
                      className={css({
                        width: "100%",
                        padding: "2",
                        border: "1px solid",
                        borderColor: "gray.300",
                        borderRadius: "md",
                        fontSize: "sm",
                      })}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="shipping-carrier"
                      className={css({
                        display: "block",
                        fontSize: "xs",
                        fontWeight: "medium",
                        marginBottom: "1",
                      })}
                    >
                      追跡番号
                    </label>
                    <input
                      type="text"
                      value={shippingFormData.tracking_number}
                      onChange={(e) =>
                        setShippingFormData({
                          ...shippingFormData,
                          tracking_number: e.target.value,
                        })
                      }
                      placeholder="追跡番号を入力"
                      className={css({
                        width: "100%",
                        padding: "2",
                        border: "1px solid",
                        borderColor: "gray.300",
                        borderRadius: "md",
                        fontSize: "sm",
                      })}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="shipping-notes"
                      className={css({
                        display: "block",
                        fontSize: "xs",
                        fontWeight: "medium",
                        marginBottom: "1",
                      })}
                    >
                      備考
                    </label>
                    <textarea
                      id="shipping-notes"
                      value={shippingFormData.notes}
                      onChange={(e) =>
                        setShippingFormData({
                          ...shippingFormData,
                          notes: e.target.value,
                        })
                      }
                      placeholder="配送に関する備考があれば入力"
                      rows={3}
                      className={css({
                        width: "100%",
                        padding: "2",
                        border: "1px solid",
                        borderColor: "gray.300",
                        borderRadius: "md",
                        fontSize: "sm",
                      })}
                    />
                  </div>
                  <div
                    className={css({
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: "2",
                    })}
                  >
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsShippingFormOpen(false);
                        setShippingFormData({
                          tracking_number: "",
                          carrier: "",
                          notes: "",
                        });
                      }}
                    >
                      キャンセル
                    </Button>
                    <Button
                      onClick={() => {
                        if (selectedSale) {
                          updateShippingMutation.mutate({
                            saleId: selectedSale.sale_id,
                            data: {
                              tracking_number:
                                shippingFormData.tracking_number || undefined,
                              carrier: shippingFormData.carrier || undefined,
                              notes: shippingFormData.notes || undefined,
                            },
                          });
                        }
                      }}
                      disabled={updateShippingMutation.isPending}
                    >
                      {updateShippingMutation.isPending
                        ? "登録中..."
                        : "発送登録"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* アクションボタン */}
            <div
              className={css({
                display: "flex",
                justifyContent: "flex-end",
                gap: "2",
              })}
            >
              {selectedSale.status === "pending" && (
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
              )}
              {(selectedSale.status === "completed" ||
                selectedSale.status === "pending") &&
                selectedSale.shipping_address &&
                !isShippingFormOpen && (
                  <Button onClick={() => setIsShippingFormOpen(true)}>
                    発送登録
                  </Button>
                )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
