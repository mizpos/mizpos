import { Link } from "@tanstack/react-router";
import { css } from "styled-system/css";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

interface FooterColors {
  background?: string;
  text?: string;
  linkHover?: string;
}

interface FooterProps {
  sections?: FooterSection[];
  colors?: FooterColors;
}

export default function Footer({
  sections = [
    {
      title: "ご利用ガイド",
      links: [
        { label: "配送のご案内", href: "/delivery" },
        { label: "お支払い方法", href: "/payment" },
        { label: "返品・交換について", href: "/returns" },
        { label: "よくある質問", href: "/faq" },
      ],
    },
    {
      title: "サービス",
      links: [
        { label: "書籍・同人誌の購入", href: "/products" },
        { label: "注文履歴", href: "/my-orders" },
        { label: "アカウント設定", href: "/settings" },
      ],
    },
    {
      title: "会社情報",
      links: [
        { label: "プライバシーポリシー", href: "/tos/privacy" },
        { label: "利用規約", href: "/tos" },
        { label: "特定商取引法に基づく表記", href: "/tos/scl" },
      ],
    },
  ],
  colors = {
    background: "#334143",
    text: "#ffffff",
    linkHover: "#b5ebce",
  },
}: FooterProps) {
  return (
    <footer
      className={css({
        width: "100%",
        marginTop: "auto",
      })}
      style={{ backgroundColor: colors.background }}
    >
      {/* フッターメインコンテンツ */}
      <div
        className={css({
          maxWidth: "1200px",
          margin: "0 auto",
          padding: { base: "40px 20px", md: "50px 30px", lg: "60px 40px" },
        })}
      >
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: {
              base: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
            },
            gap: { base: "30px", md: "40px" },
          })}
        >
          {sections.map((section) => (
            <div key={section.title}>
              <h3
                className={css({
                  fontSize: { base: "16px", md: "18px" },
                  fontWeight: "bold",
                  marginBottom: { base: "12px", md: "16px" },
                  color: "white",
                })}
              >
                {section.title}
              </h3>
              <ul
                className={css({
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: { base: "8px", md: "10px" },
                })}
              >
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className={css({
                        fontSize: { base: "13px", md: "14px" },
                        textDecoration: "none",
                        transition: "color 0.2s ease",
                        _hover: {
                          textDecoration: "underline",
                        },
                      })}
                      style={{
                        color: colors.text,
                      }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* コピーライト */}
      <div
        className={css({
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          padding: { base: "20px", md: "25px 30px" },
        })}
      >
        <div
          className={css({
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            flexDirection: { base: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: "center",
            gap: { base: "12px", md: "0" },
          })}
        >
          <p
            className={css({
              fontSize: { base: "12px", md: "13px" },
              margin: 0,
            })}
            style={{ color: colors.text }}
          >
            © {new Date().getFullYear()} MIZPOS Operating Team. All rights
            reserved.
          </p>
          <div
            className={css({
              display: "flex",
              gap: { base: "12px", md: "20px" },
              alignItems: "center",
            })}
          >
            <Link
              to="/privacy"
              className={css({
                fontSize: { base: "11px", md: "12px" },
                textDecoration: "none",
                _hover: {
                  textDecoration: "underline",
                },
              })}
              style={{ color: colors.text }}
            >
              プライバシーポリシー
            </Link>
            <Link
              to="/terms"
              className={css({
                fontSize: { base: "11px", md: "12px" },
                textDecoration: "none",
                _hover: {
                  textDecoration: "underline",
                },
              })}
              style={{ color: colors.text }}
            >
              利用規約
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
