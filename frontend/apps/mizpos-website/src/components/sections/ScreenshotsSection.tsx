import { useState } from "react";
import { css } from "../../../styled-system/css";
import { Badge } from "../ui/Badge";
import { Container } from "../ui/Container";

interface Screenshot {
  id: string;
  title: string;
  description: string;
  image: string;
}

const screenshots: Screenshot[] = [
  {
    id: "pos",
    title: "POS画面",
    description:
      "シンプルで直感的なPOS画面。バーコードスキャンや手動入力でスピーディーに会計できます。",
    image: "https://placehold.jp/30/4f46e5/ffffff/800x500.png?text=POS+Screen",
  },
  {
    id: "inventory",
    title: "在庫管理",
    description:
      "商品の在庫状況をリアルタイムで確認。残り少ない商品は自動でアラート表示されます。",
    image:
      "https://placehold.jp/30/0891b2/ffffff/800x500.png?text=Inventory+Management",
  },
  {
    id: "analytics",
    title: "売上分析",
    description:
      "イベントごとの売上推移やベストセラー商品をグラフで可視化。次回の仕入れ計画に活用できます。",
    image:
      "https://placehold.jp/30/ea580c/ffffff/800x500.png?text=Sales+Analytics",
  },
  {
    id: "admin",
    title: "管理画面",
    description:
      "商品登録、イベント設定、スタッフ管理などをWebブラウザから簡単に行えます。",
    image:
      "https://placehold.jp/30/374151/ffffff/800x500.png?text=Admin+Dashboard",
  },
];

export function ScreenshotsSection() {
  const [activeScreenshot, setActiveScreenshot] = useState(screenshots[0]);

  return (
    <section
      id="screenshots"
      className={css({
        paddingY: { base: "4rem", md: "6rem" },
        bg: "gray.50",
      })}
    >
      <Container>
        {/* Section Header */}
        <div
          className={css({
            textAlign: "center",
            marginBottom: { base: "3rem", md: "4rem" },
          })}
        >
          <Badge variant="secondary" className={css({ marginBottom: "1rem" })}>
            Screenshots
          </Badge>
          <h2
            className={css({
              fontSize: { base: "2rem", md: "2.5rem" },
              fontWeight: "800",
              color: "gray.900",
              marginBottom: "1rem",
            })}
          >
            シンプルで使いやすい
            <br className={css({ display: { base: "block", md: "none" } })} />
            インターフェース
          </h2>
          <p
            className={css({
              fontSize: { base: "1rem", md: "1.125rem" },
              color: "gray.600",
              maxWidth: "600px",
              marginX: "auto",
            })}
          >
            忙しいイベント中でも迷わない、直感的なUI設計。
            必要な情報がすぐに見つかります。
          </p>
        </div>

        {/* Screenshot Viewer */}
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: { base: "1fr", lg: "300px 1fr" },
            gap: { base: "1.5rem", lg: "2rem" },
            alignItems: "start",
          })}
        >
          {/* Tabs */}
          <div
            className={css({
              display: "flex",
              flexDirection: { base: "row", lg: "column" },
              gap: "0.75rem",
              overflowX: { base: "auto", lg: "visible" },
              paddingBottom: { base: "0.5rem", lg: 0 },
            })}
          >
            {screenshots.map((screenshot) => (
              <button
                type="button"
                key={screenshot.id}
                onClick={() => setActiveScreenshot(screenshot)}
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  alignItems: { base: "center", lg: "flex-start" },
                  gap: "0.25rem",
                  padding: { base: "0.75rem 1rem", lg: "1rem 1.25rem" },
                  borderRadius: "0.75rem",
                  border: "2px solid",
                  borderColor:
                    activeScreenshot.id === screenshot.id
                      ? "primary.500"
                      : "gray.200",
                  bg:
                    activeScreenshot.id === screenshot.id
                      ? "primary.50"
                      : "white",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  textAlign: { base: "center", lg: "left" },
                  minWidth: { base: "140px", lg: "auto" },
                  _hover: {
                    borderColor: "primary.300",
                  },
                })}
              >
                <span
                  className={css({
                    fontSize: "0.9375rem",
                    fontWeight: "600",
                    color:
                      activeScreenshot.id === screenshot.id
                        ? "primary.700"
                        : "gray.900",
                    whiteSpace: "nowrap",
                  })}
                >
                  {screenshot.title}
                </span>
                <span
                  className={css({
                    fontSize: "0.75rem",
                    color: "gray.500",
                    display: { base: "none", lg: "block" },
                    lineHeight: "1.4",
                  })}
                >
                  {screenshot.description}
                </span>
              </button>
            ))}
          </div>

          {/* Screenshot Display */}
          <div
            className={css({
              position: "relative",
              borderRadius: "1rem",
              overflow: "hidden",
              shadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)",
              bg: "white",
            })}
          >
            {/* Browser Chrome */}
            <div
              className={css({
                bg: "gray.800",
                paddingX: "1rem",
                paddingY: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
              })}
            >
              <div className={css({ display: "flex", gap: "0.5rem" })}>
                <div
                  className={css({
                    width: "0.75rem",
                    height: "0.75rem",
                    borderRadius: "full",
                    bg: "#ff5f57",
                  })}
                />
                <div
                  className={css({
                    width: "0.75rem",
                    height: "0.75rem",
                    borderRadius: "full",
                    bg: "#febc2e",
                  })}
                />
                <div
                  className={css({
                    width: "0.75rem",
                    height: "0.75rem",
                    borderRadius: "full",
                    bg: "#28c840",
                  })}
                />
              </div>
              <div
                className={css({
                  flex: 1,
                  bg: "gray.700",
                  borderRadius: "0.25rem",
                  paddingX: "0.75rem",
                  paddingY: "0.375rem",
                  fontSize: "0.75rem",
                  color: "gray.400",
                })}
              >
                {activeScreenshot.id === "pos"
                  ? "app://mizpos/pos"
                  : `https://admin.mizpos.app/${activeScreenshot.id}`}
              </div>
            </div>
            <img
              src={activeScreenshot.image}
              alt={activeScreenshot.title}
              className={css({
                width: "100%",
                height: "auto",
                display: "block",
              })}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
