import { css } from "../../../styled-system/css";
import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { IconBrandGithub, IconMenu2, IconX } from "@tabler/icons-react";
import { useState } from "react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Screenshots", href: "#screenshots" },
  { label: "Architecture", href: "#architecture" },
  { label: "Getting Started", href: "#getting-started" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header
      className={css({
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        bg: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid",
        borderColor: "gray.200",
      })}
    >
      <Container>
        <nav
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "4rem",
          })}
        >
          {/* Logo */}
          <a
            href="/"
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              textDecoration: "none",
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
                color: "gray.900",
              })}
            >
              mizpos
            </span>
          </a>

          {/* Desktop Navigation */}
          <div
            className={css({
              display: { base: "none", md: "flex" },
              alignItems: "center",
              gap: "2rem",
            })}
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={css({
                  color: "gray.600",
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  transition: "color 0.2s ease",
                  _hover: {
                    color: "primary.600",
                  },
                })}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div
            className={css({
              display: { base: "none", md: "flex" },
              alignItems: "center",
              gap: "0.75rem",
            })}
          >
            <Button
              variant="ghost"
              size="sm"
              as="a"
              href="https://github.com/mizphses/mizpos"
            >
              <IconBrandGithub size={18} />
              GitHub
            </Button>
            <Button size="sm" as="a" href="#getting-started">
              Get Started
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={css({
              display: { base: "flex", md: "none" },
              alignItems: "center",
              justifyContent: "center",
              width: "2.5rem",
              height: "2.5rem",
              borderRadius: "0.5rem",
              border: "none",
              bg: "transparent",
              cursor: "pointer",
              color: "gray.700",
              _hover: {
                bg: "gray.100",
              },
            })}
          >
            {isMenuOpen ? <IconX size={24} /> : <IconMenu2 size={24} />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div
            className={css({
              display: { base: "flex", md: "none" },
              flexDirection: "column",
              gap: "1rem",
              paddingY: "1rem",
              borderTop: "1px solid",
              borderColor: "gray.200",
            })}
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={css({
                  color: "gray.700",
                  textDecoration: "none",
                  fontSize: "1rem",
                  fontWeight: "500",
                  paddingY: "0.5rem",
                })}
              >
                {link.label}
              </a>
            ))}
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginTop: "0.5rem",
              })}
            >
              <Button variant="secondary" as="a" href="https://github.com/mizphses/mizpos">
                <IconBrandGithub size={18} />
                View on GitHub
              </Button>
              <Button as="a" href="#getting-started">
                Get Started
              </Button>
            </div>
          </div>
        )}
      </Container>
    </header>
  );
}
