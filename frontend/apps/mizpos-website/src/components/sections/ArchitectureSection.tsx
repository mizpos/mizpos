import {
  IconApi,
  IconBrandAws,
  IconBrandPython,
  IconBrandReact,
  IconBrandTypescript,
  IconDatabase,
  IconLock,
  IconServer,
} from "@tabler/icons-react";
import { css } from "../../../styled-system/css";
import { Badge } from "../ui/Badge";
import { Card, CardContent } from "../ui/Card";
import { Container } from "../ui/Container";

interface TechItem {
  name: string;
  description: string;
  icon: React.ReactNode;
  category: "frontend" | "backend" | "infra";
}

const technologies: TechItem[] = [
  {
    name: "React + Vite",
    description: "高速なHMRと最新のReact機能を活用したフロントエンド",
    icon: <IconBrandReact size={24} />,
    category: "frontend",
  },
  {
    name: "TypeScript",
    description: "型安全な開発体験で品質を担保",
    icon: <IconBrandTypescript size={24} />,
    category: "frontend",
  },
  {
    name: "Tauri",
    description: "軽量・高速なクロスプラットフォームデスクトップアプリ",
    icon: <IconServer size={24} />,
    category: "frontend",
  },
  {
    name: "AWS Lambda",
    description: "サーバーレスで従量課金、スケーラブルなAPI",
    icon: <IconBrandAws size={24} />,
    category: "backend",
  },
  {
    name: "Python",
    description: "Lambda関数の実装言語として採用",
    icon: <IconBrandPython size={24} />,
    category: "backend",
  },
  {
    name: "API Gateway",
    description: "RESTful APIのエンドポイント管理",
    icon: <IconApi size={24} />,
    category: "backend",
  },
  {
    name: "DynamoDB",
    description: "高可用性NoSQLデータベース",
    icon: <IconDatabase size={24} />,
    category: "infra",
  },
  {
    name: "Cognito",
    description: "セキュアな認証・認可基盤",
    icon: <IconLock size={24} />,
    category: "infra",
  },
  {
    name: "Terraform",
    description: "Infrastructure as Codeでインフラを管理",
    icon: <IconBrandAws size={24} />,
    category: "infra",
  },
];

const categoryLabels = {
  frontend: { label: "Frontend", color: "primary" as const },
  backend: { label: "Backend", color: "secondary" as const },
  infra: { label: "Infrastructure", color: "accent" as const },
};

export function ArchitectureSection() {
  return (
    <section
      id="architecture"
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
          <Badge variant="primary" className={css({ marginBottom: "1rem" })}>
            Technology Stack
          </Badge>
          <h2
            className={css({
              fontSize: { base: "2rem", md: "2.5rem" },
              fontWeight: "800",
              color: "gray.900",
              marginBottom: "1rem",
            })}
          >
            モダンな技術スタック
          </h2>
          <p
            className={css({
              fontSize: { base: "1rem", md: "1.125rem" },
              color: "gray.600",
              maxWidth: "600px",
              marginX: "auto",
            })}
          >
            実績のあるAWSサービスと最新のフロントエンド技術を組み合わせ、
            保守性と拡張性を両立しています。
          </p>
        </div>

        {/* Architecture Diagram */}
        <div
          className={css({
            bg: "gray.900",
            borderRadius: "1rem",
            padding: { base: "1.5rem", md: "3rem" },
            marginBottom: { base: "3rem", md: "4rem" },
            overflow: "hidden",
          })}
        >
          <div
            className={css({
              display: "grid",
              gridTemplateColumns: { base: "1fr", md: "1fr 1fr 1fr" },
              gap: { base: "2rem", md: "1.5rem" },
              alignItems: "stretch",
            })}
          >
            {/* Client */}
            <div
              className={css({
                bg: "primary.500/10",
                border: "1px solid",
                borderColor: "primary.500/30",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              })}
            >
              <h3
                className={css({
                  color: "primary.400",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "1rem",
                })}
              >
                Client Layer
              </h3>
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                })}
              >
                <div
                  className={css({
                    bg: "gray.800",
                    borderRadius: "0.5rem",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  })}
                >
                  <IconServer
                    size={18}
                    className={css({ color: "primary.400" })}
                  />
                  <span
                    className={css({ color: "gray.200", fontSize: "0.875rem" })}
                  >
                    Desktop App (Tauri)
                  </span>
                </div>
                <div
                  className={css({
                    bg: "gray.800",
                    borderRadius: "0.5rem",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  })}
                >
                  <IconBrandReact
                    size={18}
                    className={css({ color: "primary.400" })}
                  />
                  <span
                    className={css({ color: "gray.200", fontSize: "0.875rem" })}
                  >
                    Admin Web (React)
                  </span>
                </div>
              </div>
            </div>

            {/* API */}
            <div
              className={css({
                bg: "secondary.500/10",
                border: "1px solid",
                borderColor: "secondary.500/30",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              })}
            >
              <h3
                className={css({
                  color: "secondary.400",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "1rem",
                })}
              >
                API Layer
              </h3>
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                })}
              >
                <div
                  className={css({
                    bg: "gray.800",
                    borderRadius: "0.5rem",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  })}
                >
                  <IconApi
                    size={18}
                    className={css({ color: "secondary.400" })}
                  />
                  <span
                    className={css({ color: "gray.200", fontSize: "0.875rem" })}
                  >
                    API Gateway
                  </span>
                </div>
                <div
                  className={css({
                    bg: "gray.800",
                    borderRadius: "0.5rem",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  })}
                >
                  <IconBrandAws
                    size={18}
                    className={css({ color: "secondary.400" })}
                  />
                  <span
                    className={css({ color: "gray.200", fontSize: "0.875rem" })}
                  >
                    Lambda (Python)
                  </span>
                </div>
              </div>
            </div>

            {/* Data */}
            <div
              className={css({
                bg: "accent.500/10",
                border: "1px solid",
                borderColor: "accent.500/30",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              })}
            >
              <h3
                className={css({
                  color: "accent.400",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "1rem",
                })}
              >
                Data Layer
              </h3>
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                })}
              >
                <div
                  className={css({
                    bg: "gray.800",
                    borderRadius: "0.5rem",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  })}
                >
                  <IconDatabase
                    size={18}
                    className={css({ color: "accent.400" })}
                  />
                  <span
                    className={css({ color: "gray.200", fontSize: "0.875rem" })}
                  >
                    DynamoDB
                  </span>
                </div>
                <div
                  className={css({
                    bg: "gray.800",
                    borderRadius: "0.5rem",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  })}
                >
                  <IconLock
                    size={18}
                    className={css({ color: "accent.400" })}
                  />
                  <span
                    className={css({ color: "gray.200", fontSize: "0.875rem" })}
                  >
                    Cognito
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Connection lines visual hint */}
          <div
            className={css({
              display: { base: "none", md: "flex" },
              justifyContent: "center",
              gap: "8rem",
              marginTop: "1.5rem",
            })}
          >
            <div
              className={css({
                width: "120px",
                height: "2px",
                background:
                  "linear-gradient(90deg, rgba(99, 102, 241, 0.5), rgba(6, 182, 212, 0.5))",
              })}
            />
            <div
              className={css({
                width: "120px",
                height: "2px",
                background:
                  "linear-gradient(90deg, rgba(6, 182, 212, 0.5), rgba(249, 115, 22, 0.5))",
              })}
            />
          </div>
        </div>

        {/* Tech Grid */}
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: {
              base: "1fr",
              sm: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
            },
            gap: "1.5rem",
          })}
        >
          {technologies.map((tech) => {
            const category = categoryLabels[tech.category];
            return (
              <Card key={tech.name} hover>
                <CardContent>
                  <div
                    className={css({
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "1rem",
                    })}
                  >
                    <div
                      className={css({
                        color: `${category.color}.500`,
                        flexShrink: 0,
                      })}
                    >
                      {tech.icon}
                    </div>
                    <div>
                      <div
                        className={css({
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.25rem",
                        })}
                      >
                        <h3
                          className={css({
                            fontSize: "1rem",
                            fontWeight: "600",
                            color: "gray.900",
                          })}
                        >
                          {tech.name}
                        </h3>
                      </div>
                      <p
                        className={css({
                          fontSize: "0.875rem",
                          color: "gray.600",
                          lineHeight: "1.5",
                        })}
                      >
                        {tech.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
