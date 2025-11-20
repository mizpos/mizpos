import { IconMenu2, IconSearch, IconX } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import { useAuth } from "../contexts/AuthContext";
import { CartIcon } from "./CartIcon";

interface NavigationItem {
  label: string;
  href: string;
}

interface HeaderColors {
  topBar?: string;
  navigationBar?: string;
  searchButton?: string;
}

interface HeaderProps {
  navigationItems?: NavigationItem[];
  colors?: HeaderColors;
  cartItemCount?: number;
}

export default function Header({
  navigationItems = [
    { label: "書籍・同人誌", href: "/products" },
    { label: "配送のご案内", href: "/delivery" },
  ],
  colors = {
    topBar: "#3a585d",
    navigationBar: "#334143",
    searchButton: "#b5ebce",
  },
  cartItemCount = 0,
}: HeaderProps) {
  const { user, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  return (
    <header>
      {/* 上部バー */}
      <div
        className={css({
          display: "flex",
          gap: { base: "8px", md: "15px", lg: "25px" },
          justifyContent: "space-between",
          alignItems: "center",
          padding: { base: "10px", md: "15px", lg: "20px" },
          width: "100%",
          flexWrap: { base: "wrap", lg: "nowrap" },
        })}
        style={{ backgroundColor: colors.topBar }}
      >
        {/* ロゴとハンバーガーメニュー */}
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "10px",
            order: { base: "1", lg: "1" },
          })}
        >
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={css({
              display: { base: "flex", lg: "none" },
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "5px",
              _hover: {
                opacity: 0.8,
              },
            })}
            aria-label="メニュー"
          >
            {isMobileMenuOpen ? <IconX size={24} /> : <IconMenu2 size={24} />}
          </button>
          <Link
            to="/"
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              height: { base: "30px", md: "40px", lg: "45px" },
              alignItems: "center",
              justifyContent: "center",
              paddingX: { base: "8px", md: "12px", lg: "15px" },
              paddingY: { base: "8px", md: "10px", lg: "13px" },
              width: { base: "80px", md: "110px", lg: "138px" },
            })}
          >
            <img
              src="/logo.png"
              alt="utteru 販売プラットフォーム"
              className={css({
                height: { base: "20px", md: "26px", lg: "32px" },
                width: "auto",
              })}
            />
          </Link>
        </div>

        {/* 検索バー */}
        <div
          className={css({
            flex: { base: "1 1 100%", lg: "1" },
            order: { base: "3", lg: "2" },
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: "5px",
            paddingX: { base: "10px", md: "10px", lg: "13px" },
            minHeight: { base: "40px", md: "auto" },
          })}
        >
          <input
            type="text"
            placeholder="商品を検索"
            className={css({
              flex: "1",
              border: "none",
              outline: "none",
              fontSize: { base: "14px", md: "12px" },
              fontWeight: "medium",
              paddingY: { base: "10px", md: "10px" },
              backgroundColor: "transparent",
            })}
          />
          <button
            type="button"
            className={css({
              display: "flex",
              gap: "10px",
              alignItems: "center",
              justifyContent: "center",
              padding: "3px",
              borderRadius: "2px",
              width: { base: "30px", md: "27px" },
              height: { base: "30px", md: "27px" },
              border: "none",
              cursor: "pointer",
              flexShrink: 0,
            })}
            style={{ backgroundColor: colors.searchButton }}
          >
            <IconSearch
              size={16}
              className={css({ display: { base: "block", md: "none" } })}
            />
            <IconSearch
              size={12}
              className={css({ display: { base: "none", md: "block" } })}
            />
          </button>
        </div>

        {/* アカウント情報 */}
        {user ? (
          <div
            className={css({
              display: { base: "none", md: "flex" },
              flexDirection: "column",
              alignItems: "flex-start",
              color: "white",
              lineHeight: "1",
              position: "relative",
              order: { base: "4", lg: "3" },
            })}
          >
            <p
              className={css({
                fontSize: { base: "11px", md: "12px" },
                fontWeight: "medium",
              })}
            >
              こんにちは、
              {user.name || user.email?.split("@")[0] || user.username}さん
            </p>
            <div
              className={css({
                display: "flex",
                gap: "8px",
                alignItems: "center",
              })}
            >
              <Link
                to="/settings"
                className={css({
                  fontSize: { base: "12px", md: "14px" },
                  fontWeight: "bold",
                  color: "white",
                  textDecoration: "none",
                  _hover: {
                    textDecoration: "underline",
                  },
                })}
              >
                アカウント設定
              </Link>
              <span className={css({ color: "white", fontSize: "12px" })}>
                |
              </span>
              <Link
                to="/my-orders"
                className={css({
                  fontSize: { base: "12px", md: "14px" },
                  fontWeight: "bold",
                  color: "white",
                  textDecoration: "none",
                  _hover: {
                    textDecoration: "underline",
                  },
                })}
              >
                注文履歴
              </Link>
              <span className={css({ color: "white", fontSize: "12px" })}>
                |
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className={css({
                  fontSize: { base: "12px", md: "14px" },
                  fontWeight: "bold",
                  color: "white",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  _hover: {
                    textDecoration: "underline",
                  },
                })}
              >
                ログアウト
              </button>
            </div>
          </div>
        ) : (
          <Link
            to="/login"
            className={css({
              display: { base: "none", md: "flex" },
              flexDirection: "column",
              alignItems: "flex-start",
              color: "white",
              lineHeight: "1",
              order: { base: "4", lg: "3" },
              _hover: {
                opacity: 0.8,
              },
            })}
          >
            <p
              className={css({
                fontSize: { base: "11px", md: "12px" },
                fontWeight: "medium",
              })}
            >
              こんにちは、ゲストさん
            </p>
            <p
              className={css({
                fontSize: { base: "12px", md: "14px" },
                fontWeight: "bold",
              })}
            >
              ログインして注文履歴を見る
            </p>
          </Link>
        )}

        {/* カート */}
        <Link
          to="/cart"
          className={css({
            display: "flex",
            gap: "2px",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            borderRadius: "5px",
            padding: "3px",
            cursor: "pointer",
            textDecoration: "none",
            order: { base: "2", lg: "4" },
            _hover: {
              background: "#ffffff1a",
            },
          })}
        >
          <div
            className={css({
              display: "inline-flex",
              width: { base: "32px", md: "36px", lg: "40px" },
              height: { base: "32px", md: "36px", lg: "40px" },
            })}
          >
            <CartIcon size={40} color="white" itemCount={cartItemCount} />
          </div>
          <div
            className={css({
              display: { base: "none", sm: "flex" },
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
            })}
          >
            <p
              className={css({
                fontSize: { base: "11px", md: "12px" },
                fontWeight: "bold",
                color: "white",
              })}
            >
              カート
            </p>
          </div>
        </Link>
      </div>

      {/* ナビゲーションバー（デスクトップ） */}
      <div
        className={css({
          display: { base: "none", lg: "flex" },
          gap: "10px",
          alignItems: "center",
          paddingX: "15px",
          paddingY: "6px",
          fontWeight: "bold",
          color: "white",
          width: "100%",
        })}
        style={{ backgroundColor: colors.navigationBar }}
      >
        {navigationItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={css({
              cursor: "pointer",
              textDecoration: "none",
              color: "white",
              "&:hover": {
                textDecoration: "underline",
              },
            })}
          >
            {item.label}
          </a>
        ))}
      </div>

      {/* モバイルメニュー */}
      {isMobileMenuOpen && (
        <div
          className={css({
            display: { base: "block", lg: "none" },
            padding: "15px",
          })}
          style={{ backgroundColor: colors.navigationBar }}
        >
          {/* ナビゲーションリンク */}
          <nav
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "15px",
              marginBottom: user ? "15px" : "0",
              paddingBottom: user ? "15px" : "0",
              borderBottom: user
                ? "1px solid rgba(255, 255, 255, 0.2)"
                : "none",
            })}
          >
            {navigationItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={css({
                  color: "white",
                  textDecoration: "none",
                  fontWeight: "bold",
                  fontSize: "16px",
                  padding: "8px 0",
                  _hover: {
                    textDecoration: "underline",
                  },
                })}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>

          {/* アカウント情報（モバイル） */}
          {user ? (
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                color: "white",
              })}
            >
              <p
                className={css({
                  fontSize: "14px",
                  fontWeight: "medium",
                })}
              >
                こんにちは、
                {user.name || user.email?.split("@")[0] || user.username}さん
              </p>
              <Link
                to="/settings"
                className={css({
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "white",
                  textDecoration: "none",
                  padding: "8px 0",
                  _hover: {
                    textDecoration: "underline",
                  },
                })}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                アカウント設定
              </Link>
              <Link
                to="/my-orders"
                className={css({
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "white",
                  textDecoration: "none",
                  padding: "8px 0",
                  _hover: {
                    textDecoration: "underline",
                  },
                })}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                注文履歴
              </Link>
              <button
                type="button"
                onClick={() => {
                  handleSignOut();
                  setIsMobileMenuOpen(false);
                }}
                className={css({
                  fontSize: "16px",
                  fontWeight: "bold",
                  color: "white",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "8px 0",
                  textAlign: "left",
                  _hover: {
                    textDecoration: "underline",
                  },
                })}
              >
                ログアウト
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                color: "white",
                textDecoration: "none",
                padding: "8px 0",
                _hover: {
                  opacity: 0.8,
                },
              })}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <p
                className={css({
                  fontSize: "14px",
                  fontWeight: "medium",
                })}
              >
                こんにちは、ゲストさん
              </p>
              <p
                className={css({
                  fontSize: "16px",
                  fontWeight: "bold",
                })}
              >
                ログインして注文履歴を見る
              </p>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
