import { css } from "../../../styled-system/css";
import { Container } from "../ui/Container";
import { IconBrandGithub, IconBrandTwitter, IconHeart } from "@tabler/icons-react";

const footerLinks = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Screenshots", href: "#screenshots" },
    { label: "Architecture", href: "#architecture" },
  ],
  resources: [
    { label: "Documentation", href: "https://github.com/mizphses/mizpos#readme" },
    { label: "Getting Started", href: "#getting-started" },
    { label: "Contributing", href: "https://github.com/mizphses/mizpos/blob/main/CONTRIBUTING.md" },
  ],
  community: [
    { label: "GitHub", href: "https://github.com/mizphses/mizpos" },
    { label: "Issues", href: "https://github.com/mizphses/mizpos/issues" },
    { label: "Discussions", href: "https://github.com/mizphses/mizpos/discussions" },
  ],
};

export function Footer() {
  return (
    <footer
      className={css({
        bg: "gray.900",
        color: "gray.300",
        paddingY: "4rem",
      })}
    >
      <Container>
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: { base: "1fr", md: "2fr 1fr 1fr 1fr" },
            gap: { base: "2rem", md: "4rem" },
          })}
        >
          {/* Brand */}
          <div>
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "1rem",
              })}
            >
              <div
                className={css({
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "0.5rem",
                  background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: "bold",
                  fontSize: "0.875rem",
                })}
              >
                M
              </div>
              <span
                className={css({
                  fontSize: "1.25rem",
                  fontWeight: "700",
                  color: "white",
                })}
              >
                mizpos
              </span>
            </div>
            <p
              className={css({
                fontSize: "0.875rem",
                lineHeight: "1.6",
                maxWidth: "280px",
              })}
            >
              同人イベント向けに最適化されたサーバーレスPOSシステム。
              完全クラウドベースで、どこからでも在庫と売上を管理できます。
            </p>
            <div
              className={css({
                display: "flex",
                gap: "1rem",
                marginTop: "1.5rem",
              })}
            >
              <a
                href="https://github.com/mizphses/mizpos"
                className={css({
                  color: "gray.400",
                  transition: "color 0.2s ease",
                  _hover: { color: "white" },
                })}
              >
                <IconBrandGithub size={20} />
              </a>
              <a
                href="https://twitter.com/mizphses"
                className={css({
                  color: "gray.400",
                  transition: "color 0.2s ease",
                  _hover: { color: "white" },
                })}
              >
                <IconBrandTwitter size={20} />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4
              className={css({
                color: "white",
                fontWeight: "600",
                marginBottom: "1rem",
                fontSize: "0.875rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              })}
            >
              Product
            </h4>
            <ul
              className={css({
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              })}
            >
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={css({
                      fontSize: "0.875rem",
                      color: "gray.400",
                      textDecoration: "none",
                      transition: "color 0.2s ease",
                      _hover: { color: "white" },
                    })}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4
              className={css({
                color: "white",
                fontWeight: "600",
                marginBottom: "1rem",
                fontSize: "0.875rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              })}
            >
              Resources
            </h4>
            <ul
              className={css({
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              })}
            >
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={css({
                      fontSize: "0.875rem",
                      color: "gray.400",
                      textDecoration: "none",
                      transition: "color 0.2s ease",
                      _hover: { color: "white" },
                    })}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4
              className={css({
                color: "white",
                fontWeight: "600",
                marginBottom: "1rem",
                fontSize: "0.875rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              })}
            >
              Community
            </h4>
            <ul
              className={css({
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              })}
            >
              {footerLinks.community.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className={css({
                      fontSize: "0.875rem",
                      color: "gray.400",
                      textDecoration: "none",
                      transition: "color 0.2s ease",
                      _hover: { color: "white" },
                    })}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div
          className={css({
            borderTop: "1px solid",
            borderColor: "gray.800",
            marginTop: "3rem",
            paddingTop: "2rem",
            display: "flex",
            flexDirection: { base: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { base: "center", md: "center" },
            gap: "1rem",
          })}
        >
          <p
            className={css({
              fontSize: "0.875rem",
              color: "gray.500",
            })}
          >
            &copy; {new Date().getFullYear()} mizpos. Released under the MIT License.
          </p>
          <p
            className={css({
              fontSize: "0.875rem",
              color: "gray.500",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            })}
          >
            Made with <IconHeart size={14} className={css({ color: "red.500" })} /> for doujin creators
          </p>
        </div>
      </Container>
    </footer>
  );
}
