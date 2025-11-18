import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { css } from "styled-system/css";
import CheckoutForm from "../../components/CheckoutForm";
import { useCart } from "../../contexts/CartContext";
import {
  type CartItem as ApiCartItem,
  createOrder,
  createOrderPaymentIntent,
} from "../../lib/api";

// Stripe公開可能キーを読み込み
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

export const Route = createFileRoute("/checkout/")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { items, subtotal } = useCart();
  const [step, setStep] = useState<"info" | "payment">("info");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
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

  // 注文作成mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const cartItems: ApiCartItem[] = items.map((item) => ({
        product_id: item.product.product_id,
        quantity: item.quantity,
        unit_price: item.product.price,
      }));

      const order = await createOrder({
        cart_items: cartItems,
        customer_email: customerInfo.email,
        customer_name: customerInfo.name,
        shipping_address: {
          name: customerInfo.name,
          postal_code: customerInfo.postalCode,
          prefecture: customerInfo.prefecture,
          city: customerInfo.city,
          address_line1: customerInfo.address_line1,
          address_line2: customerInfo.address_line2,
          phone_number: customerInfo.phone_number,
        },
      });

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
                <Elements
                  stripe={stripePromise}
                  options={{ clientSecret }}
                >
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
