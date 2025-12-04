import { css } from "styled-system/css";
import { Button, Input } from "../ui";

export interface CustomerInfo {
  email: string;
  name: string;
  postalCode: string;
  prefecture: string;
  city: string;
  address_line1: string;
  address_line2: string;
  phone_number: string;
}

interface ShippingFormProps {
  customerInfo: CustomerInfo;
  onChange: (info: CustomerInfo) => void;
  onSubmit: (e: React.FormEvent) => void;
  isReadOnly?: boolean;
}

export function ShippingForm({
  customerInfo,
  onChange,
  onSubmit,
  isReadOnly = false,
}: ShippingFormProps) {
  const handleChange = (field: keyof CustomerInfo) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onChange({ ...customerInfo, [field]: e.target.value });
  };

  return (
    <form onSubmit={onSubmit}>
      <Input
        id="email"
        type="email"
        label="メールアドレス"
        required
        readOnly
        autoComplete="email"
        value={customerInfo.email}
        onChange={handleChange("email")}
      />

      <Input
        id="name"
        type="text"
        label="お名前"
        required
        readOnly={isReadOnly}
        value={customerInfo.name}
        onChange={handleChange("name")}
      />

      <Input
        id="postalCode"
        type="text"
        label="郵便番号"
        required
        readOnly={isReadOnly}
        placeholder="例: 123-4567"
        value={customerInfo.postalCode}
        onChange={handleChange("postalCode")}
      />

      <Input
        id="prefecture"
        type="text"
        label="都道府県"
        required
        readOnly={isReadOnly}
        placeholder="例: 東京都"
        value={customerInfo.prefecture}
        onChange={handleChange("prefecture")}
      />

      <Input
        id="city"
        type="text"
        label="市区町村"
        required
        readOnly={isReadOnly}
        placeholder="例: 渋谷区"
        value={customerInfo.city}
        onChange={handleChange("city")}
      />

      <Input
        id="address1"
        type="text"
        label="町名・番地"
        required
        readOnly={isReadOnly}
        placeholder="例: 道玄坂1-2-3"
        value={customerInfo.address_line1}
        onChange={handleChange("address_line1")}
      />

      <Input
        id="address2"
        type="text"
        label="建物名・部屋番号"
        readOnly={isReadOnly}
        placeholder="例: ○○ビル 101号室"
        value={customerInfo.address_line2}
        onChange={handleChange("address_line2")}
      />

      <div className={css({ marginBottom: "24px" })}>
        <Input
          id="phone"
          type="tel"
          label="電話番号"
          required
          readOnly={isReadOnly}
          placeholder="例: 03-1234-5678"
          value={customerInfo.phone_number}
          onChange={handleChange("phone_number")}
        />
      </div>

      <Button type="submit" size="lg" fullWidth>
        お支払いへ進む
      </Button>
    </form>
  );
}
