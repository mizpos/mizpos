import { css } from "../../../styled-system/css";
import { Container } from "../ui/Container";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";
import {
  IconBrandGithub,
  IconTerminal2,
  IconRocket,
  IconSettings,
  IconArrowRight,
  IconCopy,
  IconCheck,
} from "@tabler/icons-react";
import { useState } from "react";

interface Step {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: Step[] = [
  {
    number: "01",
    title: "リポジトリをクローン",
    description: "GitHubからソースコードを取得します",
    icon: <IconBrandGithub size={24} />,
  },
  {
    number: "02",
    title: "AWSインフラをデプロイ",
    description: "Terraformで必要なAWSリソースを構築",
    icon: <IconTerminal2 size={24} />,
  },
  {
    number: "03",
    title: "環境設定",
    description: "Cognito、DynamoDBの設定をアプリに反映",
    icon: <IconSettings size={24} />,
  },
  {
    number: "04",
    title: "イベントを開始",
    description: "商品登録してPOSシステムを稼働開始",
    icon: <IconRocket size={24} />,
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "2rem",
        height: "2rem",
        borderRadius: "0.375rem",
        border: "none",
        bg: "transparent",
        color: "gray.400",
        cursor: "pointer",
        transition: "all 0.2s ease",
        _hover: {
          bg: "gray.700",
          color: "gray.200",
        },
      })}
    >
      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
    </button>
  );
}

export function GettingStartedSection() {
  return (
    <section
      id="getting-started"
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
          <Badge variant="accent" className={css({ marginBottom: "1rem" })}>
            Getting Started
          </Badge>
          <h2
            className={css({
              fontSize: { base: "2rem", md: "2.5rem" },
              fontWeight: "800",
              color: "gray.900",
              marginBottom: "1rem",
            })}
          >
            数ステップで導入完了
          </h2>
          <p
            className={css({
              fontSize: { base: "1rem", md: "1.125rem" },
              color: "gray.600",
              maxWidth: "600px",
              marginX: "auto",
            })}
          >
            OSSだから、自分のAWSアカウントにデプロイして
            完全にコントロールできます。
          </p>
        </div>

        {/* Steps */}
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: { base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
            gap: { base: "1.5rem", md: "2rem" },
            marginBottom: { base: "3rem", md: "4rem" },
          })}
        >
          {steps.map((step, index) => (
            <div key={index} className={css({ position: "relative" })}>
              <Card gradient>
                <CardContent>
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                    })}
                  >
                    <span
                      className={css({
                        fontSize: "2rem",
                        fontWeight: "800",
                        color: "primary.200",
                        lineHeight: 1,
                      })}
                    >
                      {step.number}
                    </span>
                    <div className={css({ color: "primary.500" })}>{step.icon}</div>
                  </div>
                  <h3
                    className={css({
                      fontSize: "1.125rem",
                      fontWeight: "700",
                      color: "gray.900",
                      marginBottom: "0.5rem",
                    })}
                  >
                    {step.title}
                  </h3>
                  <p
                    className={css({
                      fontSize: "0.875rem",
                      color: "gray.600",
                      lineHeight: "1.5",
                    })}
                  >
                    {step.description}
                  </p>
                </CardContent>
              </Card>
              {/* Arrow between steps (desktop only) */}
              {index < steps.length - 1 && (
                <div
                  className={css({
                    display: { base: "none", lg: "flex" },
                    position: "absolute",
                    top: "50%",
                    right: "-1.5rem",
                    transform: "translateY(-50%)",
                    color: "gray.300",
                    zIndex: 10,
                  })}
                >
                  <IconArrowRight size={24} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Code Block */}
        <div
          className={css({
            bg: "gray.900",
            borderRadius: "1rem",
            overflow: "hidden",
            maxWidth: "800px",
            marginX: "auto",
            marginBottom: { base: "3rem", md: "4rem" },
          })}
        >
          {/* Terminal header */}
          <div
            className={css({
              bg: "gray.800",
              paddingX: "1rem",
              paddingY: "0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            })}
          >
            <div className={css({ display: "flex", alignItems: "center", gap: "0.5rem" })}>
              <div className={css({ display: "flex", gap: "0.5rem" })}>
                <div className={css({ width: "0.75rem", height: "0.75rem", borderRadius: "full", bg: "#ff5f57" })} />
                <div className={css({ width: "0.75rem", height: "0.75rem", borderRadius: "full", bg: "#febc2e" })} />
                <div className={css({ width: "0.75rem", height: "0.75rem", borderRadius: "full", bg: "#28c840" })} />
              </div>
              <span className={css({ color: "gray.400", fontSize: "0.75rem", marginLeft: "0.5rem" })}>Terminal</span>
            </div>
          </div>
          {/* Code content */}
          <div className={css({ padding: "1.5rem" })}>
            <div className={css({ display: "flex", flexDirection: "column", gap: "1rem", fontFamily: "mono" })}>
              <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between" })}>
                <code className={css({ color: "gray.300", fontSize: "0.875rem" })}>
                  <span className={css({ color: "gray.500" })}>$</span> git clone https://github.com/mizphses/mizpos.git
                </code>
                <CopyButton text="git clone https://github.com/mizphses/mizpos.git" />
              </div>
              <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between" })}>
                <code className={css({ color: "gray.300", fontSize: "0.875rem" })}>
                  <span className={css({ color: "gray.500" })}>$</span> cd mizpos
                </code>
                <CopyButton text="cd mizpos" />
              </div>
              <div className={css({ display: "flex", alignItems: "center", justifyContent: "space-between" })}>
                <code className={css({ color: "gray.300", fontSize: "0.875rem" })}>
                  <span className={css({ color: "gray.500" })}>$</span> make deploy-dev
                </code>
                <CopyButton text="make deploy-dev" />
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div
          className={css({
            textAlign: "center",
          })}
        >
          <div
            className={css({
              display: "flex",
              flexDirection: { base: "column", sm: "row" },
              justifyContent: "center",
              gap: "1rem",
            })}
          >
            <Button size="lg" as="a" href="https://github.com/mizphses/mizpos">
              <IconBrandGithub size={20} />
              View on GitHub
            </Button>
            <Button variant="secondary" size="lg" as="a" href="https://github.com/mizphses/mizpos#readme">
              Read Documentation
              <IconArrowRight size={18} />
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
