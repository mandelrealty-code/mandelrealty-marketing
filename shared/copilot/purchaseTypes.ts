export type PurchaseDetail = {
  kind: "detail";
  propertyId: string;
  property: string;
  item: string;
  category: string;
  left: number;
  threshold: number | null;
  productName: string;
  retailer: string;
  priceCents: number | null;
  imageUrl: string;
  productUrl: string;
  quantity: number;
  shipTo: string;
  missing: string;
  canBuy: boolean;
  overview: string;
};

export type PurchaseOrdered = {
  kind: "ordered";
  propertyId: string;
  property: string;
  item: string;
  productName: string;
  retailer: string;
  quantity: number;
  confirmation: string;
  delivery: string;
  tracking: string;
};

export type PurchaseFailed = {
  kind: "failed";
  reason: string;
  detail: PurchaseDetail;
};

export type PurchaseSkipped = {
  kind: "skipped";
  item: string;
  property: string;
};

export type PurchaseHeld = {
  kind: "not_now";
  property: string;
  item: string;
};

export type PurchaseState = PurchaseDetail | PurchaseOrdered | PurchaseFailed | PurchaseSkipped | PurchaseHeld;

export type PurchaseSource = {
  propertyId: string;
  property: string;
  item: string;
  category?: string;
  left: number;
  threshold?: number | null;
  restockQty?: number | null;
  productName?: string;
  retailer?: string;
  priceCents?: number | null;
  imageUrl?: string;
  productUrl?: string;
  shipTo?: string;
};

export type SupplyWrite = {
  propertyId: string;
  property: string;
  item: string;
  product: string;
  quantity: number;
  confirmation: string;
  tracking: string;
  delivery: string;
};

export type DeliveryStatus = "ordered" | "shipped" | "delivered";

export type RecordedSupply = SupplyWrite & { status: DeliveryStatus };
