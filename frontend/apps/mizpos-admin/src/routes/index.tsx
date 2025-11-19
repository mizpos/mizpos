import {
  IconBox,
  IconCash,
  IconShoppingCart,
  IconTrendingUp,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { css } from "styled-system/css";
import { Header } from "../components/Header";
import { getAuthenticatedClients } from "../lib/api";
import { STOCK_LOW_THRESHOLD } from "../lib/constants";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

interface Sale {
  sale_id: string;
  total: number;
  status: "pending" | "completed" | "shipped" | "cancelled";
  created_at: string;
  completed_at?: string;
}

interface Product {
  product_id: string;
  name: string;
  stock_quantity: number;
}

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, change, icon, color }: StatCardProps) {
  return (
    <div
      className={css({
        backgroundColor: "white",
        borderRadius: "lg",
        padding: "6",
        boxShadow: "sm",
        border: "1px solid",
        borderColor: "gray.200",
      })}
    >
      <div
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        })}
      >
        <div>
          <p
            className={css({
              fontSize: "sm",
              color: "gray.500",
              marginBottom: "1",
            })}
          >
            {title}
          </p>
          <p
            className={css({
              fontSize: "2xl",
              fontWeight: "bold",
              color: "gray.900",
            })}
          >
            {value}
          </p>
          {change && (
            <p
              className={css({
                fontSize: "xs",
                color: "success",
                marginTop: "1",
              })}
            >
              {change}
            </p>
          )}
        </div>
        <div
          className={css({
            padding: "3",
            borderRadius: "lg",
            backgroundColor: color,
          })}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  // 売上データを取得
  const { data: salesData = [], isLoading: salesLoading } = useQuery({
    queryKey: ["dashboard-sales"],
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

  // 商品データを取得
  const { data: productsData = [], isLoading: productsLoading } = useQuery({
    queryKey: ["dashboard-products"],
    queryFn: async () => {
      const { stock } = await getAuthenticatedClients();
      const { data, error } = await stock.GET("/products");
      if (error) throw error;
      const response = data as unknown as { products: Product[] };
      return response.products || [];
    },
  });

  // 統計を計算
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
    );

    // 本日の売上
    const todaySales = salesData.filter((sale) => {
      const saleDate = new Date(sale.created_at);
      return saleDate >= todayStart && sale.status === "completed";
    });
    const todayRevenue = todaySales.reduce(
      (sum, sale) => sum + (sale.total || 0),
      0,
    );
    const todayOrderCount = todaySales.length;

    // 昨日の売上
    const yesterdaySales = salesData.filter((sale) => {
      const saleDate = new Date(sale.created_at);
      return (
        saleDate >= yesterdayStart &&
        saleDate < todayStart &&
        sale.status === "completed"
      );
    });
    const yesterdayRevenue = yesterdaySales.reduce(
      (sum, sale) => sum + (sale.total || 0),
      0,
    );
    const yesterdayOrderCount = yesterdaySales.length;

    // 前日比
    const revenueChange =
      yesterdayRevenue > 0
        ? (
            ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) *
            100
          ).toFixed(1)
        : null;
    const orderChange =
      yesterdayOrderCount > 0
        ? (
            ((todayOrderCount - yesterdayOrderCount) / yesterdayOrderCount) *
            100
          ).toFixed(1)
        : null;

    // 今月の売上
    const thisMonthSales = salesData.filter((sale) => {
      const saleDate = new Date(sale.created_at);
      return saleDate >= monthStart && sale.status === "completed";
    });
    const thisMonthRevenue = thisMonthSales.reduce(
      (sum, sale) => sum + (sale.total || 0),
      0,
    );

    // 先月の売上
    const lastMonthSales = salesData.filter((sale) => {
      const saleDate = new Date(sale.created_at);
      return (
        saleDate >= lastMonthStart &&
        saleDate <= lastMonthEnd &&
        sale.status === "completed"
      );
    });
    const lastMonthRevenue = lastMonthSales.reduce(
      (sum, sale) => sum + (sale.total || 0),
      0,
    );

    // 月間成長率
    const monthlyGrowth =
      lastMonthRevenue > 0
        ? (
            ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) *
            100
          ).toFixed(1)
        : null;

    // 在庫アラート
    const lowStockProducts = productsData.filter(
      (product) => product.stock_quantity <= STOCK_LOW_THRESHOLD,
    );

    return {
      todayRevenue,
      todayOrderCount,
      revenueChange,
      orderChange,
      monthlyGrowth,
      lowStockCount: lowStockProducts.length,
    };
  }, [salesData, productsData]);

  const isLoading = salesLoading || productsLoading;

  return (
    <>
      <Header title="ダッシュボード" />
      <div
        className={css({
          flex: "1",
          padding: "6",
          overflowY: "auto",
        })}
      >
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
          <>
            <div
              className={css({
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: "6",
                marginBottom: "6",
              })}
            >
              <StatCard
                title="本日の売上"
                value={`¥${stats.todayRevenue.toLocaleString()}`}
                change={
                  stats.revenueChange
                    ? `${Number(stats.revenueChange) >= 0 ? "+" : ""}${stats.revenueChange}% 前日比`
                    : undefined
                }
                icon={<IconCash size={24} color="white" />}
                color="var(--colors-primary-500)"
              />
              <StatCard
                title="注文数"
                value={`${stats.todayOrderCount}`}
                change={
                  stats.orderChange
                    ? `${Number(stats.orderChange) >= 0 ? "+" : ""}${stats.orderChange}% 前日比`
                    : undefined
                }
                icon={<IconShoppingCart size={24} color="white" />}
                color="var(--colors-success)"
              />
              <StatCard
                title="在庫アラート"
                value={`${stats.lowStockCount}件`}
                icon={<IconBox size={24} color="white" />}
                color="var(--colors-warning)"
              />
              <StatCard
                title="月間成長率"
                value={
                  stats.monthlyGrowth
                    ? `${Number(stats.monthlyGrowth) >= 0 ? "+" : ""}${stats.monthlyGrowth}%`
                    : "N/A"
                }
                icon={<IconTrendingUp size={24} color="white" />}
                color="var(--colors-primary-600)"
              />
            </div>

            <div
              className={css({
                backgroundColor: "white",
                borderRadius: "lg",
                padding: "6",
                boxShadow: "sm",
                border: "1px solid",
                borderColor: "gray.200",
              })}
            >
              <h3
                className={css({
                  fontSize: "lg",
                  fontWeight: "semibold",
                  marginBottom: "4",
                  color: "gray.900",
                })}
              >
                最近の活動
              </h3>
              <p
                className={css({
                  color: "gray.500",
                  fontSize: "sm",
                })}
              >
                データを読み込み中...
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
