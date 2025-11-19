import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fetchUserAttributes } from "aws-amplify/auth";
import { useEffect, useState } from "react";
import { css } from "styled-system/css";
import CheckoutForm from "../../components/CheckoutForm";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import {
  type CartItem as ApiCartItem,
  createOrder,
  createOrderPaymentIntent,
  getUserAddresses,
  type SavedAddress,
} from "../../lib/api";

// Stripe公開可能キーを読み込み
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

export const Route = createFileRoute("/checkout/")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"info" | "payment">("info");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const [useManualAddress, setUseManualAddress] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    email: "",
    name: "",
    postalCode: "",
    prefecture: "",
    city: "",
    address_line1: "",
    address_line2: "",
    phone_number: "",
  });

  // ログインチェック
  useEffect(() => {
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/checkout" } });
    }
  }, [user, navigate]);

  // ユーザー情報を取得
  useQuery({
    queryKey: ["userAttributes"],
    queryFn: async () => {
      try {
        const attributes = await fetchUserAttributes();
        setCustomerInfo((prev) => ({
          ...prev,
          email: attributes.email || prev.email,
          name: attributes.name || prev.name,
        }));
        return attributes;
      } catch {
        return null;
      }
    },
    enabled: !!user,
  });

  // 登録済み住所を取得（ログイン済みユーザーのみ）
  const { data: savedAddresses = [] } = useQuery({
    queryKey: ["addresses", user?.sub],
    queryFn: () => getUserAddresses(user?.sub || ""),
    enabled: !!user?.sub,
  });

  // 選択された住所を自動入力
  const handleAddressSelect = (address: SavedAddress) => {
    setSelectedAddressId(address.address_id);
    setUseManualAddress(false);
    setCustomerInfo({
      ...customerInfo,
      name: address.name,
      postalCode: address.postal_code,
      prefecture: address.prefecture,
      city: address.city,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || "",
      phone_number: address.phone_number,
    });
  };

  // 注文作成mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const cartItems: ApiCartItem[] = items.map((item) => ({
        product_id: item.product.product_id,
        quantity: item.quantity,
        unit_price: item.product.price,
      }));

      // 登録済み住所を使用する場合と手動入力の場合で分岐
      const orderRequest: Parameters<typeof createOrder>[0] = {
        cart_items: cartItems,
        customer_email: customerInfo.email,
        customer_name: customerInfo.name,
      };

      if (selectedAddressId && !useManualAddress && user?.sub) {
        // 登録済み住所を使用
        orderRequest.saved_address_id = selectedAddressId;
        orderRequest.user_id = user.sub;
      } else {
        // 手動入力の住所を使用
        orderRequest.shipping_address = {
          name: customerInfo.name,
          postal_code: customerInfo.postalCode,
          prefecture: customerInfo.prefecture,
          city: customerInfo.city,
          address_line1: customerInfo.address_line1,
          address_line2: customerInfo.address_line2,
          phone_number: customerInfo.phone_number,
        };
      }

      const order = await createOrder(orderRequest);
      return order;
    },
    onSuccess: async (order) => {
      const orderId = order.order_id || order.sale_id || "";
      setOrderId(orderId);

      // PaymentIntent作成
      try {
        const paymentIntent = await createOrderPaymentIntent(orderId);
        setClientSecret(paymentIntent.client_secret);
      } catch (error) {
        console.error("PaymentIntent creation failed:", error);
      }
    },
  });

  if (items.length === 0) {
    return (
      <div
        className={css({
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "40px 20px",
          textAlign: "center",
        })}
      >
        <h1
          className={css({
            fontSize: "32px",
            fontWeight: "bold",
            marginBottom: "20px",
          })}
        >
          チェックアウト
        </h1>
        <p
          className={css({
            fontSize: "18px",
            marginBottom: "30px",
            color: "#666",
          })}
        >
          カートが空です
        </p>
      </div>
    );
  }

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // 注文を作成してPaymentIntentを取得
    createOrderMutation.mutate();
    setStep("payment");
  };

  return (
    <div
      className={css({
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "40px 20px",
      })}
    >
      <h1
        className={css({
          fontSize: "32px",
          fontWeight: "bold",
          marginBottom: "30px",
        })}
      >
        チェックアウト
      </h1>

      <div
        className={css({
          display: "grid",
          gridTemplateColumns: { base: "1fr", md: "2fr 1fr" },
          gap: "30px",
        })}
      >
        {/* メインコンテンツ */}
        <div>
          {step === "info" ? (
            /* 配送情報入力フォーム */
            <div
              className={css({
                padding: "24px",
                backgroundColor: "white",
                borderRadius: "8px",
                border: "1px solid #ddd",
              })}
            >
              <h2
                className={css({
                  fontSize: "24px",
                  fontWeight: "bold",
                  marginBottom: "20px",
                })}
              >
                配送先情報
              </h2>

              {/* 登録済み住所の選択（ログイン済みユーザーのみ） */}
              {!!user?.sub && savedAddresses.length > 0 && (
                <div className={css({ marginBottom: "24px" })}>
                  <div
                    className={css({
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "12px",
                    })}
                  >
                    <h3
                      className={css({
                        fontSize: "16px",
                        fontWeight: "bold",
                      })}
                    >
                      登録済みの住所から選択
                    </h3>
                    <Link to="/my-addresses">
                      <button
                        type="button"
                        className={css({
                          fontSize: "14px",
                          color: "#007185",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          textDecoration: "underline",
                          _hover: {
                            color: "#c7511f",
                          },
                        })}
                      >
                        住所を管理
                      </button>
                    </Link>
                  </div>

                  <div
                    className={css({
                      display: "grid",
                      gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
                      gap: "12px",
                      marginBottom: "12px",
                    })}
                  >
                    {savedAddresses.map((address) => (
                      <button
                        key={address.address_id}
                        type="button"
                        onClick={() => handleAddressSelect(address)}
                        className={css({
                          padding: "12px",
                          textAlign: "left",
                          border:
                            selectedAddressId === address.address_id &&
                            !useManualAddress
                              ? "2px solid #007bff"
                              : "1px solid #ddd",
                          borderRadius: "4px",
                          backgroundColor:
                            selectedAddressId === address.address_id &&
                            !useManualAddress
                              ? "#e7f3ff"
                              : "white",
                          cursor: "pointer",
                          position: "relative",
                          _hover: {
                            borderColor: "#007bff",
                          },
                        })}
                      >
                        {address.is_default && (
                          <span
                            className={css({
                              position: "absolute",
                              top: "4px",
                              right: "4px",
                              fontSize: "10px",
                              backgroundColor: "#007bff",
                              color: "white",
                              padding: "2px 6px",
                              borderRadius: "3px",
                            })}
                          >
                            デフォルト
                          </span>
                        )}
                        <div
                          className={css({
                            fontSize: "14px",
                            fontWeight: "bold",
                            marginBottom: "4px",
                          })}
                        >
                          {address.label}
                        </div>
                        <div className={css({ fontSize: "12px" })}>
                          {address.name}
                        </div>
                        <div className={css({ fontSize: "12px" })}>
                          〒{address.postal_code}
                        </div>
                        <div className={css({ fontSize: "12px" })}>
                          {address.prefecture}
                          {address.city}
                          {address.address_line1}
                        </div>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setUseManualAddress(true);
                      setSelectedAddressId(null);
                    }}
                    className={css({
                      fontSize: "14px",
                      color: "#007185",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                      marginBottom: "16px",
                      _hover: {
                        color: "#c7511f",
                      },
                    })}
                  >
                    {useManualAddress ? "手動入力中" : "新しい住所を手動で入力"}
                  </button>
                </div>
              )}

              <form onSubmit={handleInfoSubmit}>
                <div className={css({ marginBottom: "16px" })}>
                  <label
                    htmlFor="email"
                    className={css({
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "bold",
                    })}
                  >
                    メールアドレス *
                  </label>
                  <input
                    type="email"
                    autoComplete="email"
                    id="email"
                    required
                    readOnly
                    value={customerInfo.email}
                    onChange={(e) =>
                      setCustomerInfo({
                        ...customerInfo,
                        email: e.target.value,
                      })
                    }
                    className={css({
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                      backgroundColor: "#f5f5f5",
                      cursor: "not-allowed",
                    })}
                  />
                </div>

                <div className={css({ marginBottom: "16px" })}>
                  <label
                    htmlFor="name"
                    className={css({
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "bold",
                    })}
                  >
                    お名前 *
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    readOnly={!!selectedAddressId && !useManualAddress}
                    value={customerInfo.name}
                    onChange={(e) =>
                      setCustomerInfo({ ...customerInfo, name: e.target.value })
                    }
                    className={css({
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                      backgroundColor:
                        !!selectedAddressId && !useManualAddress
                          ? "#f5f5f5"
                          : "white",
                      cursor:
                        !!selectedAddressId && !useManualAddress
                          ? "not-allowed"
                          : "text",
                    })}
                  />
                </div>

                <div className={css({ marginBottom: "16px" })}>
                  <label
                    htmlFor="postalCode"
                    className={css({
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "bold",
                    })}
                  >
                    郵便番号 *
                  </label>
                  <input
                    type="text"
                    id="postalCode"
                    required
                    readOnly={!!selectedAddressId && !useManualAddress}
                    placeholder="例: 123-4567"
                    value={customerInfo.postalCode}
                    onChange={(e) =>
                      setCustomerInfo({
                        ...customerInfo,
                        postalCode: e.target.value,
                      })
                    }
                    className={css({
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                      backgroundColor:
                        !!selectedAddressId && !useManualAddress
                          ? "#f5f5f5"
                          : "white",
                      cursor:
                        !!selectedAddressId && !useManualAddress
                          ? "not-allowed"
                          : "text",
                    })}
                  />
                </div>

                <div className={css({ marginBottom: "16px" })}>
                  <label
                    htmlFor="prefecture"
                    className={css({
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "bold",
                    })}
                  >
                    都道府県 *
                  </label>
                  <input
                    type="text"
                    id="prefecture"
                    required
                    readOnly={!!selectedAddressId && !useManualAddress}
                    placeholder="例: 東京都"
                    value={customerInfo.prefecture}
                    onChange={(e) =>
                      setCustomerInfo({
                        ...customerInfo,
                        prefecture: e.target.value,
                      })
                    }
                    className={css({
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                      backgroundColor:
                        !!selectedAddressId && !useManualAddress
                          ? "#f5f5f5"
                          : "white",
                      cursor:
                        !!selectedAddressId && !useManualAddress
                          ? "not-allowed"
                          : "text",
                    })}
                  />
                </div>

                <div className={css({ marginBottom: "16px" })}>
                  <label
                    htmlFor="city"
                    className={css({
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "bold",
                    })}
                  >
                    市区町村 *
                  </label>
                  <input
                    type="text"
                    id="city"
                    required
                    readOnly={!!selectedAddressId && !useManualAddress}
                    placeholder="例: 渋谷区"
                    value={customerInfo.city}
                    onChange={(e) =>
                      setCustomerInfo({ ...customerInfo, city: e.target.value })
                    }
                    className={css({
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                      backgroundColor:
                        !!selectedAddressId && !useManualAddress
                          ? "#f5f5f5"
                          : "white",
                      cursor:
                        !!selectedAddressId && !useManualAddress
                          ? "not-allowed"
                          : "text",
                    })}
                  />
                </div>

                <div className={css({ marginBottom: "16px" })}>
                  <label
                    htmlFor="address1"
                    className={css({
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "bold",
                    })}
                  >
                    町名・番地 *
                  </label>
                  <input
                    type="text"
                    id="address1"
                    required
                    readOnly={!!selectedAddressId && !useManualAddress}
                    placeholder="例: 道玄坂1-2-3"
                    value={customerInfo.address_line1}
                    onChange={(e) =>
                      setCustomerInfo({
                        ...customerInfo,
                        address_line1: e.target.value,
                      })
                    }
                    className={css({
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                      backgroundColor:
                        !!selectedAddressId && !useManualAddress
                          ? "#f5f5f5"
                          : "white",
                      cursor:
                        !!selectedAddressId && !useManualAddress
                          ? "not-allowed"
                          : "text",
                    })}
                  />
                </div>

                <div className={css({ marginBottom: "16px" })}>
                  <label
                    htmlFor="address2"
                    className={css({
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "bold",
                    })}
                  >
                    建物名・部屋番号
                  </label>
                  <input
                    type="text"
                    id="address2"
                    readOnly={!!selectedAddressId && !useManualAddress}
                    placeholder="例: ○○ビル 101号室"
                    value={customerInfo.address_line2}
                    onChange={(e) =>
                      setCustomerInfo({
                        ...customerInfo,
                        address_line2: e.target.value,
                      })
                    }
                    className={css({
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                      backgroundColor:
                        !!selectedAddressId && !useManualAddress
                          ? "#f5f5f5"
                          : "white",
                      cursor:
                        !!selectedAddressId && !useManualAddress
                          ? "not-allowed"
                          : "text",
                    })}
                  />
                </div>

                <div className={css({ marginBottom: "24px" })}>
                  <label
                    htmlFor="phone"
                    className={css({
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: "bold",
                    })}
                  >
                    電話番号 *
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    required
                    readOnly={!!selectedAddressId && !useManualAddress}
                    placeholder="例: 03-1234-5678"
                    value={customerInfo.phone_number}
                    onChange={(e) =>
                      setCustomerInfo({
                        ...customerInfo,
                        phone_number: e.target.value,
                      })
                    }
                    className={css({
                      width: "100%",
                      padding: "10px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      fontSize: "14px",
                      backgroundColor:
                        !!selectedAddressId && !useManualAddress
                          ? "#f5f5f5"
                          : "white",
                      cursor:
                        !!selectedAddressId && !useManualAddress
                          ? "not-allowed"
                          : "text",
                    })}
                  />
                </div>

                <button
                  type="submit"
                  className={css({
                    width: "100%",
                    padding: "14px",
                    backgroundColor: "#f0c14b",
                    border: "1px solid #a88734",
                    borderRadius: "3px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    _hover: {
                      backgroundColor: "#ddb347",
                    },
                  })}
                >
                  お支払いへ進む
                </button>
              </form>
            </div>
          ) : (
            /* 決済フォーム */
            <div
              className={css({
                padding: "24px",
                backgroundColor: "white",
                borderRadius: "8px",
                border: "1px solid #ddd",
              })}
            >
              <h2
                className={css({
                  fontSize: "24px",
                  fontWeight: "bold",
                  marginBottom: "20px",
                })}
              >
                お支払い情報
              </h2>
              <button
                type="button"
                onClick={() => setStep("info")}
                className={css({
                  marginBottom: "16px",
                  color: "#007185",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontSize: "14px",
                  _hover: {
                    color: "#c7511f",
                  },
                })}
              >
                ← 配送先情報を編集
              </button>
              {clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <CheckoutForm orderId={orderId || ""} />
                </Elements>
              ) : (
                <div className={css({ padding: "40px", textAlign: "center" })}>
                  <p>決済の準備中...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 注文サマリー */}
        <div
          className={css({
            padding: "20px",
            backgroundColor: "#f3f3f3",
            borderRadius: "8px",
            height: "fit-content",
          })}
        >
          <h2
            className={css({
              fontSize: "20px",
              fontWeight: "bold",
              marginBottom: "16px",
            })}
          >
            注文内容
          </h2>

          <div className={css({ marginBottom: "16px" })}>
            {items.map((item) => (
              <div
                key={item.product.product_id}
                className={css({
                  display: "flex",
                  gap: "12px",
                  marginBottom: "12px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #ddd",
                })}
              >
                <div
                  className={css({
                    width: "60px",
                    height: "80px",
                    backgroundColor: "#fff",
                    borderRadius: "4px",
                    overflow: "hidden",
                    flexShrink: 0,
                  })}
                >
                  {item.product.image_url ? (
                    <img
                      src={item.product.image_url}
                      alt={item.product.name}
                      className={css({
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      })}
                    />
                  ) : (
                    <div
                      className={css({
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        color: "#999",
                        fontSize: "10px",
                      })}
                    >
                      No Image
                    </div>
                  )}
                </div>
                <div className={css({ flex: 1 })}>
                  <p
                    className={css({
                      fontSize: "14px",
                      fontWeight: "bold",
                      marginBottom: "4px",
                    })}
                  >
                    {item.product.name}
                  </p>
                  <p className={css({ fontSize: "12px", color: "#666" })}>
                    数量: {item.quantity}
                  </p>
                  <p
                    className={css({
                      fontSize: "14px",
                      fontWeight: "bold",
                      color: "#e47911",
                    })}
                  >
                    ¥{(item.product.price * item.quantity).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div
            className={css({
              borderTop: "1px solid #ddd",
              paddingTop: "16px",
              marginBottom: "16px",
            })}
          >
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              })}
            >
              <span className={css({ fontSize: "14px" })}>小計:</span>
              <span className={css({ fontSize: "14px", fontWeight: "bold" })}>
                ¥{subtotal.toLocaleString()}
              </span>
            </div>
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              })}
            >
              <span className={css({ fontSize: "14px" })}>配送料:</span>
              <span className={css({ fontSize: "14px", fontWeight: "bold" })}>
                ¥0
              </span>
            </div>
          </div>

          <div
            className={css({ borderTop: "2px solid #ddd", paddingTop: "16px" })}
          >
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
              })}
            >
              <span className={css({ fontSize: "18px", fontWeight: "bold" })}>
                合計:
              </span>
              <span
                className={css({
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#e47911",
                })}
              >
                ¥{subtotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
