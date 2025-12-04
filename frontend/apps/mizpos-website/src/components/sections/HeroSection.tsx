import { css } from "../../../styled-system/css";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { IconBrandGithub, IconArrowRight, IconCloud, IconDevices } from "@tabler/icons-react";

export function HeroSection() {
  return (
    <section
      className={css({
        position: "relative",
        overflow: "hidden",
        paddingTop: { base: "8rem", md: "10rem" },
        paddingBottom: { base: "4rem", md: "6rem" },
        bg: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #ecfeff 100%)",
      })}
    >
      {/* Background decoration */}
      <div
        className={css({
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: "600px",
          height: "600px",
          borderRadius: "full",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(6, 182, 212, 0.1))",
          filter: "blur(80px)",
          pointerEvents: "none",
        })}
      />
      <div
        className={css({
          position: "absolute",
          bottom: "-10%",
          left: "-5%",
          width: "400px",
          height: "400px",
          borderRadius: "full",
          background: "linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(99, 102, 241, 0.1))",
          filter: "blur(60px)",
          pointerEvents: "none",
        })}
      />

      <Container>
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          })}
        >
          {/* Badge */}
          <Badge variant="outline" className={css({ marginBottom: "1.5rem" })}>
            <IconCloud size={14} />
            100% Serverless & Open Source
          </Badge>

          {/* Headline */}
          <h1
            className={css({
              fontSize: { base: "2.5rem", md: "3.5rem", lg: "4rem" },
              fontWeight: "800",
              lineHeight: "1.1",
              color: "gray.900",
              maxWidth: "900px",
              marginBottom: "1.5rem",
            })}
          >
            同人イベントのための
            <br />
            <span
              className={css({
                background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                backgroundClip: "text",
                color: "transparent",
              })}
            >
              スマートPOSシステム
            </span>
          </h1>

          {/* Subheadline */}
          <p
            className={css({
              fontSize: { base: "1.125rem", md: "1.25rem" },
              color: "gray.600",
              maxWidth: "640px",
              marginBottom: "2.5rem",
              lineHeight: "1.7",
            })}
          >
            完全クラウドベースで運用コスト最小。
            バーコードスキャン、在庫管理、売上分析を
            1つのプラットフォームで実現します。
          </p>

          {/* CTA Buttons */}
          <div
            className={css({
              display: "flex",
              flexDirection: { base: "column", sm: "row" },
              gap: "1rem",
              marginBottom: "4rem",
            })}
          >
            <Button size="lg" as="a" href="#getting-started">
              Get Started
              <IconArrowRight size={18} />
            </Button>
            <Button variant="secondary" size="lg" as="a" href="https://github.com/mizphses/mizpos">
              <IconBrandGithub size={20} />
              View on GitHub
            </Button>
          </div>

          {/* Hero Image / Screenshot */}
          <div
            className={css({
              position: "relative",
              width: "100%",
              maxWidth: "1000px",
              borderRadius: "1rem",
              overflow: "hidden",
              shadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid",
              borderColor: "gray.200",
            })}
          >
            {/* Browser Chrome */}
            <div
              className={css({
                bg: "gray.100",
                paddingX: "1rem",
                paddingY: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                borderBottom: "1px solid",
                borderColor: "gray.200",
              })}
            >
              <div className={css({ display: "flex", gap: "0.5rem" })}>
                <div className={css({ width: "0.75rem", height: "0.75rem", borderRadius: "full", bg: "#ff5f57" })} />
                <div className={css({ width: "0.75rem", height: "0.75rem", borderRadius: "full", bg: "#febc2e" })} />
                <div className={css({ width: "0.75rem", height: "0.75rem", borderRadius: "full", bg: "#28c840" })} />
              </div>
              <div
                className={css({
                  flex: 1,
                  bg: "white",
                  borderRadius: "0.25rem",
                  paddingX: "0.75rem",
                  paddingY: "0.25rem",
                  fontSize: "0.75rem",
                  color: "gray.500",
                  textAlign: "center",
                })}
              >
                pos.mizpos.app
              </div>
            </div>
            {/* Screenshot placeholder */}
            <img
              src="https://placehold.jp/30/f1f5f9/64748b/1200x700.png?text=POS+Dashboard+Screenshot"
              alt="mizpos dashboard screenshot"
              className={css({
                width: "100%",
                height: "auto",
                display: "block",
              })}
            />
          </div>

          {/* Stats */}
          <div
            className={css({
              display: "grid",
              gridTemplateColumns: { base: "1fr 1fr", md: "repeat(4, 1fr)" },
              gap: { base: "1.5rem", md: "3rem" },
              marginTop: "4rem",
              paddingTop: "2rem",
              borderTop: "1px solid",
              borderColor: "gray.200",
              width: "100%",
              maxWidth: "800px",
            })}
          >
            <div className={css({ textAlign: "center" })}>
              <IconCloud size={24} className={css({ color: "primary.500", marginX: "auto", marginBottom: "0.5rem" })} />
              <div className={css({ fontSize: "0.875rem", color: "gray.600" })}>Serverless</div>
            </div>
            <div className={css({ textAlign: "center" })}>
              <IconDevices size={24} className={css({ color: "secondary.500", marginX: "auto", marginBottom: "0.5rem" })} />
              <div className={css({ fontSize: "0.875rem", color: "gray.600" })}>Cross-platform</div>
            </div>
            <div className={css({ textAlign: "center" })}>
              <div className={css({ fontSize: "1.5rem", fontWeight: "700", color: "gray.900" })}>MIT</div>
              <div className={css({ fontSize: "0.875rem", color: "gray.600" })}>License</div>
            </div>
            <div className={css({ textAlign: "center" })}>
              <div className={css({ fontSize: "1.5rem", fontWeight: "700", color: "gray.900" })}>$0</div>
              <div className={css({ fontSize: "0.875rem", color: "gray.600" })}>License Fee</div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
