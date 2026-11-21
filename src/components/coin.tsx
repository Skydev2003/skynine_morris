import { Star } from "lucide-react";

export function CoinIcon() {
  return <span className="coin-icon" aria-hidden="true"><Star /></span>;
}

export function CoinBalance({ coins }: { coins?: number }) {
  return (
    <span className="shop-balance">
      <CoinIcon />
      <strong>{coins?.toLocaleString("th-TH") ?? "–"}</strong> เหรียญ
    </span>
  );
}
