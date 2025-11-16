import {
  IconBox,
  IconCash,
  IconShoppingCart,
  IconTrendingUp,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { css } from "styled-system/css";
import { Header } from "../components/Header";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

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
            value="¥125,400"
            change="+12.5% 前日比"
            icon={<IconCash size={24} color="white" />}
            color="var(--colors-primary-500)"
          />
          <StatCard
            title="注文数"
            value="48"
            change="+8.3% 前日比"
            icon={<IconShoppingCart size={24} color="white" />}
            color="var(--colors-success)"
          />
          <StatCard
            title="在庫アラート"
            value="3件"
            icon={<IconBox size={24} color="white" />}
            color="var(--colors-warning)"
          />
          <StatCard
            title="月間成長率"
            value="+15.2%"
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
      </div>
    </>
  );
}
