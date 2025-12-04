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
        pt: { base: "120px", md: "160px" },
        pb: { base: "64px", md: "96px" },
        background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #ecfeff 100%)",
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
          borderRadius: "9999px",
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
          borderRadius: "9999px",
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
          <Badge variant="outline" className={css({ mb: "24px" })}>
            <IconCloud size={14} />
            100% Serverless & Open Source
          </Badge>

          {/* Headline */}
          <h1
            className={css({
              fontSize: { base: "40px", md: "56px", lg: "64px" },
              fontWeight: "800",
              lineHeight: "1.1",
              color: "gray.900",
              maxWidth: "900px",
              mb: "24px",
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
              fontSize: { base: "18px", md: "20px" },
              color: "gray.600",
              maxWidth: "640px",
              mb: "40px",
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
              gap: "16px",
              mb: "64px",
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
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid",
              borderColor: "gray.200",
            })}
          >
            {/* Browser Chrome */}
            <div
              className={css({
                bg: "gray.100",
                px: "16px",
                py: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                borderBottom: "1px solid",
                borderColor: "gray.200",
              })}
            >
              <div className={css({ display: "flex", gap: "8px" })}>
                <div className={css({ width: "12px", height: "12px", borderRadius: "9999px", bg: "#ff5f57" })} />
                <div className={css({ width: "12px", height: "12px", borderRadius: "9999px", bg: "#febc2e" })} />
                <div className={css({ width: "12px", height: "12px", borderRadius: "9999px", bg: "#28c840" })} />
              </div>
              <div
                className={css({
                  flex: 1,
                  bg: "white",
                  borderRadius: "4px",
                  px: "12px",
                  py: "4px",
                  fontSize: "12px",
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
              gridTemplateColumns: { base: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
              gap: { base: "24px", md: "48px" },
              mt: "64px",
              pt: "32px",
              borderTop: "1px solid",
              borderColor: "gray.200",
              width: "100%",
              maxWidth: "800px",
            })}
          >
            <div className={css({ textAlign: "center" })}>
              <IconCloud size={24} className={css({ color: "primary.500", mx: "auto", mb: "8px" })} />
              <div className={css({ fontSize: "14px", color: "gray.600" })}>Serverless</div>
            </div>
            <div className={css({ textAlign: "center" })}>
              <IconDevices size={24} className={css({ color: "secondary.500", mx: "auto", mb: "8px" })} />
              <div className={css({ fontSize: "14px", color: "gray.600" })}>Cross-platform</div>
            </div>
            <div className={css({ textAlign: "center" })}>
              <div className={css({ fontSize: "24px", fontWeight: "700", color: "gray.900" })}>MIT</div>
              <div className={css({ fontSize: "14px", color: "gray.600" })}>License</div>
            </div>
            <div className={css({ textAlign: "center" })}>
              <div className={css({ fontSize: "24px", fontWeight: "700", color: "gray.900" })}>$0</div>
              <div className={css({ fontSize: "14px", color: "gray.600" })}>License Fee</div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
