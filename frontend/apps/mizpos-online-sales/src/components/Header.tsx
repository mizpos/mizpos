import { IconSearch } from "@tabler/icons-react";
import { css } from "styled-system/css";
import { CartIcon } from "./CartIcon";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../contexts/AuthContext";

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
          gap: "25px",
          alignItems: "center",
          padding: "20px",
          width: "100%",
        })}
        style={{ backgroundColor: colors.topBar }}
      >
        <Link
          to="/"
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            height: "45px",
            alignItems: "center",
            justifyContent: "center",
            paddingX: "15px",
            paddingY: "13px",
            width: "138px",
          })}
        >
          <img
            src="/logo.png"
            alt="mizpos Online Sales"
            className={css({
              height: "32px",
            })}
          />
        </Link>

        <div
          className={css({
            flex: "1",
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: "5px",
            paddingX: "13px",
          })}
        >
          <input
            type="text"
            placeholder="商品を検索"
            className={css({
              flex: "1",
              border: "none",
              outline: "none",
              fontSize: "12px",
              fontWeight: "medium",
              paddingY: "10px",
              backgroundColor: "transparent",
            })}
          />
          <button
            className={css({
              display: "flex",
              gap: "10px",
              alignItems: "center",
              justifyContent: "center",
              padding: "3px",
              borderRadius: "2px",
              width: "27px",
              height: "27px",
              border: "none",
              cursor: "pointer",
            })}
            style={{ backgroundColor: colors.searchButton }}
          >
            <IconSearch size={12} />
          </button>
        </div>

        {/* アカウント情報 */}
        {user ? (
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              color: "white",
              lineHeight: "1",
              position: "relative",
            })}
          >
            <p
              className={css({
                fontSize: "12px",
                fontWeight: "medium",
              })}
            >
              こんにちは、{user.name || user.email.split("@")[0]}さん
            </p>
            <div className={css({ display: "flex", gap: "8px", alignItems: "center" })}>
              <Link
                to="/my-orders"
                className={css({
                  fontSize: "14px",
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
              <span className={css({ color: "white", fontSize: "12px" })}>|</span>
              <button
                onClick={handleSignOut}
                className={css({
                  fontSize: "14px",
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
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              color: "white",
              lineHeight: "1",
              _hover: {
                opacity: 0.8,
              },
            })}
          >
            <p
              className={css({
                fontSize: "12px",
                fontWeight: "medium",
              })}
            >
              こんにちは、ゲストさん
            </p>
            <p
              className={css({
                fontSize: "14px",
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
            _hover: {
              background: "#ffffff1a",
            },
          })}
        >
          <div
            className={css({
              display: "inline-flex",
            })}
          >
            <CartIcon size={40} color="white" itemCount={cartItemCount} />
          </div>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "center",
            })}
          >
            <p
              className={css({
                fontSize: "12px",
                fontWeight: "bold",
                color: "white",
              })}
            >
              カート
            </p>
          </div>
        </Link>
      </div>

      {/* ナビゲーションバー */}
      <div
        className={css({
          display: "flex",
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
        {navigationItems.map((item, index) => (
          <a
            key={index}
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
    </header>
  );
}
