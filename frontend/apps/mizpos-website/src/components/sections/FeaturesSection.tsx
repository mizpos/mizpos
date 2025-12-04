import { css } from "../../../styled-system/css";
import { Container } from "../ui/Container";
import { Card, CardContent } from "../ui/Card";
import {
  IconBarcode,
  IconChartBar,
  IconCloud,
  IconDevices,
  IconLock,
  IconRefresh,
  IconUsers,
  IconCurrencyYen,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

interface Feature {
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
}

const features: Feature[] = [
  {
    icon: <IconBarcode size={28} />,
    title: "バーコードスキャン",
    description: "スマートフォンのカメラで商品バーコードを読み取り。素早く正確な会計を実現します。",
    color: "primary",
  },
  {
    icon: <IconChartBar size={28} />,
    title: "リアルタイム売上分析",
    description: "売上データをリアルタイムで可視化。どの商品が売れているか一目で把握できます。",
    color: "secondary",
  },
  {
    icon: <IconRefresh size={28} />,
    title: "在庫同期",
    description: "複数端末間で在庫情報を自動同期。売り切れを防ぎ、機会損失を最小化します。",
    color: "accent",
  },
  {
    icon: <IconCloud size={28} />,
    title: "サーバーレス設計",
    description: "AWS Lambda + DynamoDBによる完全サーバーレス。使った分だけの従量課金で運用コストを最小化。",
    color: "primary",
  },
  {
    icon: <IconDevices size={28} />,
    title: "クロスプラットフォーム",
    description: "Windows、Mac、Linux対応のデスクトップアプリ。Web管理画面からどこでもアクセス可能。",
    color: "secondary",
  },
  {
    icon: <IconUsers size={28} />,
    title: "マルチユーザー対応",
    description: "複数のスタッフが同時に利用可能。権限管理でセキュアな運用を実現します。",
    color: "accent",
  },
  {
    icon: <IconLock size={28} />,
    title: "セキュア認証",
    description: "AWS Cognitoによる堅牢な認証基盤。安心してデータを管理できます。",
    color: "primary",
  },
  {
    icon: <IconCurrencyYen size={28} />,
    title: "無料で利用可能",
    description: "MITライセンスのOSS。ライセンス費用なしで自由にカスタマイズ・運用できます。",
    color: "secondary",
  },
];

const colorMap = {
  primary: {
    bg: "primary.100",
    color: "primary.600",
  },
  secondary: {
    bg: "secondary.100",
    color: "secondary.600",
  },
  accent: {
    bg: "accent.100",
    color: "accent.600",
  },
};

export function FeaturesSection() {
  return (
    <section
      id="features"
      className={css({
        paddingY: { base: "4rem", md: "6rem" },
        bg: "white",
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
          <h2
            className={css({
              fontSize: { base: "2rem", md: "2.5rem" },
              fontWeight: "800",
              color: "gray.900",
              marginBottom: "1rem",
            })}
          >
            同人即売会に必要な
            <br className={css({ display: { base: "block", md: "none" } })} />
            すべての機能
          </h2>
          <p
            className={css({
              fontSize: { base: "1rem", md: "1.125rem" },
              color: "gray.600",
              maxWidth: "600px",
              marginX: "auto",
            })}
          >
            コミケやコミティアなどの即売会で実際に使われることを想定して設計。
            必要な機能を必要な分だけ、シンプルに。
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: { base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
            gap: { base: "1.5rem", md: "2rem" },
          })}
        >
          {features.map((feature, index) => {
            const colors = colorMap[feature.color as keyof typeof colorMap];
            return (
              <Card key={index} hover>
                <CardContent>
                  <div
                    className={css({
                      width: "3.5rem",
                      height: "3.5rem",
                      borderRadius: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "1.25rem",
                      bg: colors.bg,
                      color: colors.color,
                    })}
                  >
                    {feature.icon}
                  </div>
                  <h3
                    className={css({
                      fontSize: "1.125rem",
                      fontWeight: "700",
                      color: "gray.900",
                      marginBottom: "0.5rem",
                    })}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className={css({
                      fontSize: "0.875rem",
                      color: "gray.600",
                      lineHeight: "1.6",
                    })}
                  >
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
