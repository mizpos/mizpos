import { useCallback, useState } from "react";
import { css } from "styled-system/css";
import { useAuthStore } from "../stores/auth";
import { NumericKeypad } from "./NumericKeypad";

type InputField = "employee" | "pin";

const styles = {
  screen: css({
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1a237e 0%, #3949ab 100%)",
    padding: "20px",
  }),
  container: css({
    background: "white",
    borderRadius: "24px",
    padding: "40px",
    maxWidth: "400px",
    width: "100%",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
  }),
  header: css({
    textAlign: "center",
    marginBottom: "32px",
  }),
  title: css({
    fontSize: "36px",
    fontWeight: 700,
    color: "#1a237e",
    margin: "0 0 8px 0",
  }),
  subtitle: css({
    fontSize: "14px",
    color: "#666",
    margin: 0,
  }),
  form: css({
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  }),
  inputGroup: css({
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  }),
  label: css({
    fontSize: "14px",
    fontWeight: 600,
    color: "#333",
  }),
  inputDisplay: css({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    border: "2px solid #e0e0e0",
    borderRadius: "12px",
    background: "#fafafa",
    cursor: "pointer",
    transition: "all 0.2s ease",
    textAlign: "left",
    fontFamily: "inherit",
    _hover: {
      borderColor: "#bdbdbd",
    },
  }),
  inputDisplayActive: css({
    borderColor: "#1a237e",
    background: "#e8eaf6",
    boxShadow: "0 0 0 3px rgba(26, 35, 126, 0.1)",
  }),
  inputValue: css({
    fontSize: "24px",
    fontWeight: 600,
    color: "#333",
    letterSpacing: "4px",
  }),
  inputMasked: css({
    letterSpacing: "8px",
  }),
  inputHint: css({
    fontSize: "12px",
    color: "#999",
  }),
  error: css({
    padding: "12px 16px",
    background: "#ffebee",
    border: "1px solid #ef9a9a",
    borderRadius: "8px",
    color: "#c62828",
    fontSize: "14px",
    textAlign: "center",
  }),
  button: css({
    padding: "18px",
    fontSize: "18px",
    fontWeight: 600,
    color: "white",
    background: "#1a237e",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginTop: "16px",
    _hover: {
      background: "#283593",
    },
    _active: {
      transform: "scale(0.98)",
    },
    _disabled: {
      background: "#9fa8da",
      cursor: "not-allowed",
      _hover: {
        background: "#9fa8da",
      },
      _active: {
        transform: "none",
      },
    },
  }),
  footer: css({
    marginTop: "24px",
    textAlign: "center",
  }),
  footerText: css({
    fontSize: "12px",
    color: "#999",
    margin: 0,
  }),
};

export function LoginScreen() {
  const [activeField, setActiveField] = useState<InputField>("employee");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [pin, setPin] = useState("");

  const { login, isLoading, error, clearError } = useAuthStore();

  const handleKeypadChange = useCallback(
    (value: string) => {
      clearError();
      if (activeField === "employee") {
        // 従業員番号は7桁まで
        if (value.length <= 7) {
          setEmployeeNumber(value);
          // 7桁入力したら自動でPINフィールドへ
          if (value.length === 7) {
            setActiveField("pin");
          }
        }
      } else {
        // PINは8桁まで
        if (value.length <= 8) {
          setPin(value);
        }
      }
    },
    [activeField, clearError],
  );

  const handleLogin = useCallback(async () => {
    if (employeeNumber.length !== 7) {
      return;
    }
    if (pin.length < 3) {
      return;
    }

    const success = await login(employeeNumber, pin);
    if (!success) {
      // エラーはストアで管理
      setPin(""); // PINをクリア
    }
  }, [employeeNumber, pin, login]);

  const handleFieldFocus = useCallback(
    (field: InputField) => {
      clearError();
      setActiveField(field);
    },
    [clearError],
  );

  const currentValue = activeField === "employee" ? employeeNumber : pin;
  const isFormValid = employeeNumber.length === 7 && pin.length >= 3;

  return (
    <div className={styles.screen}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>mizPOS</h1>
          <p className={styles.subtitle}>販売管理システム</p>
        </div>

        <div className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="employee-number" className={styles.label}>
              従業員番号
            </label>
            <button
              type="button"
              id="employee-number"
              className={`${styles.inputDisplay} ${
                activeField === "employee" ? styles.inputDisplayActive : ""
              }`}
              onClick={() => handleFieldFocus("employee")}
            >
              <span className={styles.inputValue}>
                {employeeNumber || "0000000"}
              </span>
              <span className={styles.inputHint}>7桁</span>
            </button>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="pin" className={styles.label}>
              PIN
            </label>
            <button
              type="button"
              id="pin"
              className={`${styles.inputDisplay} ${
                activeField === "pin" ? styles.inputDisplayActive : ""
              }`}
              onClick={() => handleFieldFocus("pin")}
            >
              <span className={`${styles.inputValue} ${styles.inputMasked}`}>
                {"●".repeat(pin.length) || "●●●"}
              </span>
              <span className={styles.inputHint}>3桁以上</span>
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <NumericKeypad
            value={currentValue}
            onChange={handleKeypadChange}
            maxLength={activeField === "employee" ? 7 : 8}
          />

          <button
            type="button"
            className={styles.button}
            onClick={handleLogin}
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? "ログイン中..." : "ログイン"}
          </button>
        </div>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            ログインできない場合は管理者にお問い合わせください
          </p>
        </div>
      </div>
    </div>
  );
}
