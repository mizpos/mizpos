/**
 * ログイン画面
 * 従業員番号（7桁）とPIN（3桁以上）でログイン
 */

import { useCallback, useState } from "react";
import { useAuthStore } from "../stores/auth";
import { NumericKeypad } from "./NumericKeypad";
import "./LoginScreen.css";

type InputField = "employee" | "pin";

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
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <h1>mizPOS</h1>
          <p className="login-subtitle">販売管理システム</p>
        </div>

        <div className="login-form">
          <div className="input-group">
            <label htmlFor="employee-number">従業員番号</label>
            <button
              type="button"
              id="employee-number"
              className={`input-display ${activeField === "employee" ? "active" : ""}`}
              onClick={() => handleFieldFocus("employee")}
            >
              <span className="input-value">{employeeNumber || "0000000"}</span>
              <span className="input-hint">7桁</span>
            </button>
          </div>

          <div className="input-group">
            <label htmlFor="pin">PIN</label>
            <button
              type="button"
              id="pin"
              className={`input-display ${activeField === "pin" ? "active" : ""}`}
              onClick={() => handleFieldFocus("pin")}
            >
              <span className="input-value input-masked">
                {"●".repeat(pin.length) || "●●●"}
              </span>
              <span className="input-hint">3桁以上</span>
            </button>
          </div>

          {error && <div className="login-error">{error}</div>}

          <NumericKeypad
            value={currentValue}
            onChange={handleKeypadChange}
            maxLength={activeField === "employee" ? 7 : 8}
          />

          <button
            type="button"
            className="login-button"
            onClick={handleLogin}
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? "ログイン中..." : "ログイン"}
          </button>
        </div>

        <div className="login-footer">
          <p>ログインできない場合は管理者にお問い合わせください</p>
        </div>
      </div>
    </div>
  );
}
