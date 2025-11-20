import { IconDownload, IconFilter } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { Button } from "../components/Button";
import { Header } from "../components/Header";
import { getAuthenticatedClients } from "../lib/api";
import { ONE_MONTH_MS, ONE_WEEK_MS } from "../lib/constants";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
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
  card_brand?: string;
  status: "pending" | "completed" | "cancelled";
  customer_email?: string;
  created_at: string;
}

interface Product {
  product_id: string;
  name: string;
  category: string;
  price: number;
  stock_quantity: number;
  publisher: string;
}

type ReportType =
  | "sales"
  | "products"
  | "categories"
  | "consignment"
  | "card_brands";
type DateRange = "today" | "week" | "month" | "all";

// 安全な数値フォーマット関数
function safeNumber(value: number | string | undefined | null): number {
  if (value === undefined || value === null) {
    return 0;
  }
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) {
    return 0;
  }
  return num;
}

function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [selectedPublisher, setSelectedPublisher] = useState<string>("all");
  const [selectedCardBrand, setSelectedCardBrand] = useState<string>("all");
  const [drilldownData, setDrilldownData] = useState<{
    type: string;
    value: string;
  } | null>(null);

  const handleExportPDF = () => {
    window.print();
  };

  const { data: salesData = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { sales } = await getAuthenticatedClients();
      const { data, error } = await sales.GET("/sales", {
        params: { query: { limit: 1000 } },
      });
      if (error) throw error;
      const response = data as unknown as { sales: Sale[] };
      return response.sales || [];
    },
  });

  const { data: productsData = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { stock } = await getAuthenticatedClients();
      const { data, error } = await stock.GET("/products");
      if (error) throw error;
      const response = data as unknown as { products: Product[] };
      return response.products || [];
    },
  });

  const filterByDateRange = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();

    switch (dateRange) {
      case "today": {
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        return date >= today;
      }
      case "week": {
        const weekAgo = new Date(now.getTime() - ONE_WEEK_MS);
        return date >= weekAgo;
      }
      case "month": {
        const monthAgo = new Date(now.getTime() - ONE_MONTH_MS);
        return date >= monthAgo;
      }
      default:
        return true;
    }
  };

  const completedSales = salesData.filter(
    (s) => s.status === "completed" && filterByDateRange(s.created_at),
  );

  // 委託元リストを取得（重複なし）
  const publishersList = Array.from(
    new Set(productsData.map((p) => p.publisher || "自社").filter(Boolean)),
  ).sort();

  const renderSalesReport = () => {
    const totalRevenue = completedSales.reduce(
      (sum, s) => sum + safeNumber(s.total),
      0,
    );
    const totalDiscount = completedSales.reduce(
      (sum, s) => sum + safeNumber(s.discount),
      0,
    );
    const averageOrder =
      completedSales.length > 0 ? totalRevenue / completedSales.length : 0;

    const paymentMethodBreakdown = completedSales.reduce(
      (acc, sale) => {
        acc[sale.payment_method] =
          (acc[sale.payment_method] || 0) + safeNumber(sale.total);
        return acc;
      },
      {} as Record<string, number>,
    );

    return (
      <div
        className={css({ display: "flex", flexDirection: "column", gap: "6" })}
      >
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "4",
          })}
        >
          <StatCard
            title="総売上"
            value={`¥${totalRevenue.toLocaleString()}`}
          />
          <StatCard title="注文数" value={`${completedSales.length}件`} />
          <StatCard
            title="平均注文額"
            value={`¥${Math.round(averageOrder).toLocaleString()}`}
          />
          <StatCard
            title="総割引額"
            value={`¥${totalDiscount.toLocaleString()}`}
          />
        </div>

        <div
          className={css({
            backgroundColor: "white",
            padding: "6",
            borderRadius: "lg",
            border: "1px solid",
            borderColor: "gray.200",
          })}
        >
          <h3
            className={css({
              fontSize: "lg",
              fontWeight: "semibold",
              marginBottom: "4",
            })}
          >
            決済方法別売上
          </h3>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "3",
            })}
          >
            {Object.entries(paymentMethodBreakdown).map(([method, amount]) => (
              <button
                type="button"
                key={method}
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "3",
                  backgroundColor: "gray.50",
                  borderRadius: "md",
                  cursor: "pointer",
                  border: "none",
                  width: "100%",
                  textAlign: "left",
                  _hover: {
                    backgroundColor: "gray.100",
                  },
                })}
                onClick={() => {
                  setDrilldownData({ type: "payment_method", value: method });
                }}
              >
                <span className={css({ color: "gray.700" })}>
                  {method === "stripe_online"
                    ? "オンライン決済"
                    : method === "stripe_terminal"
                      ? "端末決済"
                      : "現金"}
                </span>
                <span className={css({ fontWeight: "semibold" })}>
                  ¥{amount.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderProductsReport = () => {
    const productSales: Record<
      string,
      { name: string; quantity: number; revenue: number }
    > = {};

    completedSales.forEach((sale) => {
      sale.items.forEach((item) => {
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = {
            name: item.product_name,
            quantity: 0,
            revenue: 0,
          };
        }
        productSales[item.product_id].quantity += safeNumber(item.quantity);
        productSales[item.product_id].revenue += safeNumber(item.subtotal);
      });
    });

    const sortedProducts = Object.entries(productSales)
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .slice(0, 10);

    return (
      <div
        className={css({
          backgroundColor: "white",
          padding: "6",
          borderRadius: "lg",
          border: "1px solid",
          borderColor: "gray.200",
        })}
      >
        <h3
          className={css({
            fontSize: "lg",
            fontWeight: "semibold",
            marginBottom: "4",
          })}
        >
          売上トップ10商品
        </h3>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "3",
          })}
        >
          {sortedProducts.map(([productId, data], index) => (
            <div
              key={productId}
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "3",
                backgroundColor: index % 2 === 0 ? "gray.50" : "white",
                borderRadius: "md",
              })}
            >
              <div>
                <span
                  className={css({
                    fontWeight: "semibold",
                    marginRight: "2",
                    color: "primary.600",
                  })}
                >
                  #{index + 1}
                </span>
                <span className={css({ color: "gray.900" })}>{data.name}</span>
                <span
                  className={css({
                    color: "gray.500",
                    marginLeft: "2",
                    fontSize: "sm",
                  })}
                >
                  ({data.quantity}個)
                </span>
              </div>
              <span className={css({ fontWeight: "semibold" })}>
                ¥{data.revenue.toLocaleString()}
              </span>
            </div>
          ))}
          {sortedProducts.length === 0 && (
            <p
              className={css({
                color: "gray.500",
                textAlign: "center",
                padding: "4",
              })}
            >
              データがありません
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderCategoriesReport = () => {
    const categorySales: Record<string, { quantity: number; revenue: number }> =
      {};

    const productCategoryMap: Record<string, string> = {};
    productsData.forEach((product) => {
      productCategoryMap[product.product_id] = product.category;
    });

    completedSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const category = productCategoryMap[item.product_id] || "不明";
        if (!categorySales[category]) {
          categorySales[category] = { quantity: 0, revenue: 0 };
        }
        categorySales[category].quantity += safeNumber(item.quantity);
        categorySales[category].revenue += safeNumber(item.subtotal);
      });
    });

    const sortedCategories = Object.entries(categorySales).sort(
      ([, a], [, b]) => b.revenue - a.revenue,
    );

    return (
      <div
        className={css({
          backgroundColor: "white",
          padding: "6",
          borderRadius: "lg",
          border: "1px solid",
          borderColor: "gray.200",
        })}
      >
        <h3
          className={css({
            fontSize: "lg",
            fontWeight: "semibold",
            marginBottom: "4",
          })}
        >
          カテゴリ別売上
        </h3>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "3",
          })}
        >
          {sortedCategories.map(([category, data]) => (
            <div
              key={category}
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              })}
            >
              <div>
                <span
                  className={css({ fontWeight: "medium", color: "gray.900" })}
                >
                  {category}
                </span>
                <span
                  className={css({
                    color: "gray.500",
                    marginLeft: "2",
                    fontSize: "sm",
                  })}
                >
                  ({data.quantity}個)
                </span>
              </div>
              <span className={css({ fontWeight: "semibold" })}>
                ¥{data.revenue.toLocaleString()}
              </span>
            </div>
          ))}
          {sortedCategories.length === 0 && (
            <p
              className={css({
                color: "gray.500",
                textAlign: "center",
                padding: "4",
              })}
            >
              データがありません
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderCardBrandsReport = () => {
    const cardBrandSales: Record<
      string,
      { quantity: number; revenue: number; count: number }
    > = {};

    completedSales.forEach((sale) => {
      const brand = sale.card_brand || "不明";
      if (!cardBrandSales[brand]) {
        cardBrandSales[brand] = { quantity: 0, revenue: 0, count: 0 };
      }
      sale.items.forEach((item) => {
        cardBrandSales[brand].quantity += safeNumber(item.quantity);
      });
      cardBrandSales[brand].revenue += safeNumber(sale.total);
      cardBrandSales[brand].count += 1;
    });

    const sortedBrands = Object.entries(cardBrandSales).sort(
      ([, a], [, b]) => b.revenue - a.revenue,
    );

    return (
      <div
        className={css({
          backgroundColor: "white",
          padding: "6",
          borderRadius: "lg",
          border: "1px solid",
          borderColor: "gray.200",
        })}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "4",
          })}
        >
          <div>
            <h3
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
              })}
            >
              カードブランド別売上
            </h3>
            <p
              className={css({
                fontSize: "sm",
                color: "gray.500",
              })}
            >
              カード決済ブランドごとの売上集計
            </p>
          </div>
          <select
            value={selectedCardBrand}
            onChange={(e) => setSelectedCardBrand(e.target.value)}
            className={`${css({
              padding: "2",
              borderRadius: "md",
              border: "1px solid",
              borderColor: "gray.300",
              fontSize: "sm",
              _focus: {
                outline: "none",
                borderColor: "primary.500",
              },
            })} no-print`}
          >
            <option value="all">すべてのブランド</option>
            {sortedBrands.map(([brand]) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "3",
          })}
        >
          {sortedBrands
            .filter(
              ([brand]) =>
                selectedCardBrand === "all" || brand === selectedCardBrand,
            )
            .map(([brand, data]) => (
              <button
                type="button"
                key={brand}
                className={css({
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "3",
                  backgroundColor: "gray.50",
                  borderRadius: "md",
                  cursor: "pointer",
                  border: "none",
                  width: "100%",
                  textAlign: "left",
                  _hover: {
                    backgroundColor: "gray.100",
                  },
                })}
                onClick={() => {
                  setDrilldownData({ type: "card_brand", value: brand });
                }}
              >
                <div>
                  <span
                    className={css({
                      fontWeight: "medium",
                      color: "gray.900",
                      textTransform: "capitalize",
                    })}
                  >
                    {brand}
                  </span>
                  <span
                    className={css({
                      color: "gray.500",
                      marginLeft: "2",
                      fontSize: "sm",
                    })}
                  >
                    ({data.count}件、{data.quantity}個)
                  </span>
                </div>
                <span className={css({ fontWeight: "semibold" })}>
                  ¥{data.revenue.toLocaleString()}
                </span>
              </button>
            ))}
          {sortedBrands.length === 0 && (
            <p
              className={css({
                color: "gray.500",
                textAlign: "center",
                padding: "4",
              })}
            >
              データがありません
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderConsignmentReport = () => {
    const publisherSales: Record<
      string,
      { quantity: number; revenue: number }
    > = {};

    const productPublisherMap: Record<string, string> = {};
    productsData.forEach((product) => {
      productPublisherMap[product.product_id] = product.publisher || "自社";
    });

    completedSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const publisher = productPublisherMap[item.product_id] || "不明";
        // 委託元フィルター適用
        if (selectedPublisher !== "all" && publisher !== selectedPublisher) {
          return;
        }
        if (!publisherSales[publisher]) {
          publisherSales[publisher] = { quantity: 0, revenue: 0 };
        }
        publisherSales[publisher].quantity += safeNumber(item.quantity);
        publisherSales[publisher].revenue += safeNumber(item.subtotal);
      });
    });

    const sortedPublishers = Object.entries(publisherSales).sort(
      ([, a], [, b]) => b.revenue - a.revenue,
    );

    return (
      <div
        className={css({
          backgroundColor: "white",
          padding: "6",
          borderRadius: "lg",
          border: "1px solid",
          borderColor: "gray.200",
        })}
      >
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "4",
          })}
        >
          <div>
            <h3
              className={css({
                fontSize: "lg",
                fontWeight: "semibold",
              })}
            >
              出版社/委託元別売上
            </h3>
            <p
              className={css({
                fontSize: "sm",
                color: "gray.500",
              })}
            >
              委託販売レポート - 出版社ごとの売上集計
            </p>
          </div>
          <select
            value={selectedPublisher}
            onChange={(e) => setSelectedPublisher(e.target.value)}
            className={`${css({
              padding: "2",
              borderRadius: "md",
              border: "1px solid",
              borderColor: "gray.300",
              fontSize: "sm",
              _focus: {
                outline: "none",
                borderColor: "primary.500",
              },
            })} no-print`}
          >
            <option value="all">すべての委託元</option>
            {publishersList.map((publisher) => (
              <option key={publisher} value={publisher}>
                {publisher}
              </option>
            ))}
          </select>
        </div>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "3",
          })}
        >
          {sortedPublishers.map(([publisher, data]) => (
            <div
              key={publisher}
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "3",
                backgroundColor: "gray.50",
                borderRadius: "md",
              })}
            >
              <div>
                <span
                  className={css({ fontWeight: "medium", color: "gray.900" })}
                >
                  {publisher}
                </span>
                <span
                  className={css({
                    color: "gray.500",
                    marginLeft: "2",
                    fontSize: "sm",
                  })}
                >
                  ({data.quantity}個)
                </span>
              </div>
              <span className={css({ fontWeight: "semibold" })}>
                ¥{data.revenue.toLocaleString()}
              </span>
            </div>
          ))}
          {sortedPublishers.length === 0 && (
            <p
              className={css({
                color: "gray.500",
                textAlign: "center",
                padding: "4",
              })}
            >
              データがありません
            </p>
          )}
        </div>
      </div>
    );
  };

  const getReportTitle = () => {
    const titles: Record<ReportType, string> = {
      sales: "売上概要レポート",
      products: "商品別売上レポート",
      categories: "カテゴリ別売上レポート",
      consignment: "委託元別売上レポート",
      card_brands: "カードブランド別売上レポート",
    };
    return titles[reportType];
  };

  const getDateRangeLabel = () => {
    const labels: Record<DateRange, string> = {
      today: "今日",
      week: "過去7日間",
      month: "過去30日間",
      all: "全期間",
    };
    return labels[dateRange];
  };

  return (
    <>
      <style>
        {`
          @media print {
            header,
            .no-print {
              display: none !important;
            }
            .print-only {
              display: block !important;
            }
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            @page {
              margin: 2cm;
              size: A4;
            }
          }
          .print-only {
            display: none;
          }
        `}
      </style>
      <Header title="レポート" />
      <div
        className={css({
          flex: "1",
          padding: "6",
          overflowY: "auto",
        })}
      >
        {/* Print Header */}
        <div className="print-only" style={{ marginBottom: "24px" }}>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            {getReportTitle()}
          </h1>
          <p style={{ color: "#666", fontSize: "14px" }}>
            期間: {getDateRangeLabel()} | 出力日時:{" "}
            {new Date().toLocaleString("ja-JP")}
            {selectedPublisher !== "all" && ` | 委託元: ${selectedPublisher}`}
          </p>
        </div>

        {/* Filters */}
        <div
          className={`${css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "6",
          })} no-print`}
        >
          <div
            className={css({ display: "flex", gap: "4", alignItems: "center" })}
          >
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "2",
              })}
            >
              <IconFilter size={18} className={css({ color: "gray.500" })} />
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className={css({
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
              >
                <option value="sales">売上概要</option>
                <option value="products">商品別</option>
                <option value="categories">カテゴリ別</option>
                <option value="consignment">委託元別</option>
                <option value="card_brands">カードブランド別</option>
              </select>
            </div>

            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRange)}
              className={css({
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
            >
              <option value="today">今日</option>
              <option value="week">過去7日</option>
              <option value="month">過去30日</option>
              <option value="all">全期間</option>
            </select>
          </div>

          <Button variant="secondary" onClick={handleExportPDF}>
            <IconDownload size={18} />
            PDF出力
          </Button>
        </div>

        {/* Report Content */}
        {drilldownData ? (
          <div>
            <Button
              variant="secondary"
              onClick={() => setDrilldownData(null)}
              className={css({ marginBottom: "4" })}
            >
              ← 戻る
            </Button>
            <div
              className={css({
                backgroundColor: "white",
                padding: "6",
                borderRadius: "lg",
                border: "1px solid",
                borderColor: "gray.200",
              })}
            >
              <h3
                className={css({
                  fontSize: "lg",
                  fontWeight: "semibold",
                  marginBottom: "4",
                })}
              >
                {drilldownData.type === "payment_method"
                  ? `決済方法: ${
                      drilldownData.value === "stripe_online"
                        ? "オンライン決済"
                        : drilldownData.value === "stripe_terminal"
                          ? "端末決済"
                          : "現金"
                    }`
                  : `カードブランド: ${drilldownData.value}`}
                の詳細
              </h3>
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "2",
                })}
              >
                {completedSales
                  .filter((sale) => {
                    if (drilldownData.type === "payment_method") {
                      return sale.payment_method === drilldownData.value;
                    }
                    return (
                      sale.card_brand === drilldownData.value ||
                      (!sale.card_brand && drilldownData.value === "不明")
                    );
                  })
                  .map((sale) => (
                    <div
                      key={sale.sale_id}
                      className={css({
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "3",
                        backgroundColor: "gray.50",
                        borderRadius: "md",
                      })}
                    >
                      <div>
                        <p
                          className={css({
                            fontSize: "sm",
                            fontWeight: "medium",
                          })}
                        >
                          {sale.customer_email || sale.user_id}
                        </p>
                        <p
                          className={css({ fontSize: "xs", color: "gray.500" })}
                        >
                          {new Date(sale.created_at).toLocaleString("ja-JP")}
                        </p>
                      </div>
                      <span className={css({ fontWeight: "semibold" })}>
                        ¥{safeNumber(sale.total).toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {reportType === "sales" && renderSalesReport()}
            {reportType === "products" && renderProductsReport()}
            {reportType === "categories" && renderCategoriesReport()}
            {reportType === "consignment" && renderConsignmentReport()}
            {reportType === "card_brands" && renderCardBrandsReport()}
          </>
        )}
      </div>
    </>
  );
}

interface StatCardProps {
  title: string;
  value: string;
}

function StatCard({ title, value }: StatCardProps) {
  return (
    <div
      className={css({
        backgroundColor: "white",
        padding: "4",
        borderRadius: "lg",
        border: "1px solid",
        borderColor: "gray.200",
      })}
    >
      <p className={css({ fontSize: "sm", color: "gray.500" })}>{title}</p>
      <p
        className={css({
          fontSize: "2xl",
          fontWeight: "bold",
          color: "gray.900",
        })}
      >
        {value}
      </p>
    </div>
  );
}
