export const formatINR = (value: string | number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
        Number(value),
      );

export const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

// BookLeaf only pays out once pending royalty reaches Rs 1,000; below that it rolls over.
export const PAYOUT_THRESHOLD = 1000;
