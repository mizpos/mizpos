import { Link } from "@tanstack/react-router";
import { css } from "styled-system/css";
import type { SavedAddress } from "../../lib/api";
import { Button } from "../ui";

interface AddressSelectorProps {
  addresses: SavedAddress[];
  selectedAddressId: string | null;
  useManualAddress: boolean;
  onSelectAddress: (address: SavedAddress) => void;
  onUseManualAddress: () => void;
}

const containerStyles = css({
  marginBottom: "24px",
});

const headerStyles = css({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px",
});

const titleStyles = css({
  fontSize: "16px",
  fontWeight: "bold",
});

const gridStyles = css({
  display: "grid",
  gridTemplateColumns: { base: "1fr", md: "1fr 1fr" },
  gap: "12px",
  marginBottom: "12px",
});

const addressButtonStyles = css({
  padding: "12px",
  textAlign: "left",
  borderRadius: "4px",
  cursor: "pointer",
  position: "relative",
  transition: "all 0.2s",
  "&:hover": {
    borderColor: "#007bff",
  },
});

const defaultBadgeStyles = css({
  position: "absolute",
  top: "4px",
  right: "4px",
  fontSize: "10px",
  backgroundColor: "#007bff",
  color: "white",
  padding: "2px 6px",
  borderRadius: "3px",
});

export function AddressSelector({
  addresses,
  selectedAddressId,
  useManualAddress,
  onSelectAddress,
  onUseManualAddress,
}: AddressSelectorProps) {
  if (addresses.length === 0) {
    return null;
  }

  return (
    <div className={containerStyles}>
      <div className={headerStyles}>
        <h3 className={titleStyles}>登録済みの住所から選択</h3>
        <Link to="/my-addresses">
          <Button variant="link" size="sm">
            住所を管理
          </Button>
        </Link>
      </div>

      <div className={gridStyles}>
        {addresses.map((address) => {
          const isSelected =
            selectedAddressId === address.address_id && !useManualAddress;
          return (
            <button
              key={address.address_id}
              type="button"
              onClick={() => onSelectAddress(address)}
              className={addressButtonStyles}
              style={{
                border: isSelected ? "2px solid #007bff" : "1px solid #ddd",
                backgroundColor: isSelected ? "#e7f3ff" : "white",
              }}
            >
              {address.is_default && (
                <span className={defaultBadgeStyles}>デフォルト</span>
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
              <div className={css({ fontSize: "12px" })}>{address.name}</div>
              <div className={css({ fontSize: "12px" })}>
                〒{address.postal_code}
              </div>
              <div className={css({ fontSize: "12px" })}>
                {address.prefecture}
                {address.city}
                {address.address_line1}
              </div>
            </button>
          );
        })}
      </div>

      <Button variant="link" onClick={onUseManualAddress}>
        {useManualAddress ? "手動入力中" : "新しい住所を手動で入力"}
      </Button>
    </div>
  );
}
