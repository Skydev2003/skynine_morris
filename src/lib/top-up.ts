export const COIN_PACKS = [
  { coins: 100, baht: 29, name: "เริ่มแต่ง", example: "ซื้อกรอบรัศมีทองได้" },
  { coins: 250, baht: 59, name: "คู่หูเรืองแสง", example: "ซื้อหมากออโรร่ามิ้นต์และกรอบรัศมีทองได้" },
  { coins: 500, baht: 99, name: "จัดเต็มลงสนาม", example: "ซื้อหมากสุริยะเพลิง กรอบดาวหางฟ้า และหมากออโรร่ามิ้นต์ได้" },
] as const;

export type TopUpOrder = {
  id: string;
  baht: number;
  coins: number;
  transfer_ref: string;
  payer_name: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  player_id?: string;
};

export type TopUpState = {
  payment: { qrPath: string; recipient: string } | null;
  canReview: boolean;
  orders: TopUpOrder[];
  pending: TopUpOrder[];
};
