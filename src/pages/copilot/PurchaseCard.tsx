import { useState } from "react";
import type { PurchaseState } from "../../../shared/copilot/purchaseTypes";

function dollars(cents: number): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function failedCopy(reason: string): string {
  if (reason === "payment declined") return "The payment was declined. Nothing was charged.";
  if (reason === "out of stock") return "The product is out of stock. Nothing was charged.";
  if (reason === "retailer unreachable") return "The retailer could not be reached. Nothing was charged.";
  return `${reason} Nothing was charged.`;
}

export function PurchaseCard({
  purchase,
  busy,
  onPurchase,
  onNotNow,
  onAlternative,
  onSkip,
}: {
  purchase: PurchaseState;
  busy: boolean;
  onPurchase: (quantity: number) => void;
  onNotNow: () => void;
  onAlternative: (next: { productName: string; retailer: string; priceCents: number | null; imageUrl: string; productUrl: string }) => void;
  onSkip: () => void;
}) {
  const detail = purchase.kind === "detail" ? purchase : purchase.kind === "failed" ? purchase.detail : null;
  const [quantity, setQuantity] = useState(detail?.quantity ?? 1);
  const [finding, setFinding] = useState(false);
  const [productName, setProductName] = useState("");
  const [retailer, setRetailer] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const shownQty = detail ? quantity : 0;
  const total = detail?.priceCents == null ? null : detail.priceCents * shownQty;

  if (purchase.kind === "not_now") {
    return <p className="cp-purchase-note">Not bought. Nothing was ordered or charged. The brief stays on Overview.</p>;
  }
  if (purchase.kind === "skipped") {
    return <p className="cp-purchase-note">Skipped. Nothing was ordered. {purchase.item} stays marked low in the cleaner app, and the brief stays on Overview.</p>;
  }
  if (purchase.kind === "ordered") {
    return (
      <div className="cp-purchase">
        <p className="cp-purchase-ok">Ordered</p>
        <p>Confirmation {purchase.confirmation}. Estimated delivery {purchase.delivery}.</p>
        <p>Tracking was added to the cleaner app for {purchase.item} at {purchase.property}.</p>
        <a className="cp-purchase-link" href={purchase.tracking} target="_blank" rel="noreferrer">Track order</a>
      </div>
    );
  }
  if (!detail) return null;

  const left = Number.isInteger(detail.left) ? String(detail.left) : String(detail.left);
  const threshold = detail.threshold == null ? "" : ` of ${detail.threshold}`;

  return (
    <div className="cp-purchase">
      <div className="cp-purchase-product">
        {detail.imageUrl ? <img src={detail.imageUrl} alt="" /> : <div className="cp-purchase-photo" />}
        <div>
          {detail.retailer ? <div className="cp-purchase-retailer">{detail.retailer}</div> : null}
          <strong>{detail.productName || "Product not read"}</strong>
          {detail.priceCents != null ? <div>{dollars(detail.priceCents)}</div> : null}
        </div>
      </div>
      {detail.canBuy ? (
        <label className="cp-purchase-qty">
          Quantity
          <input
            type="number"
            min={1}
            value={shownQty}
            disabled={busy}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      ) : null}
      <dl className="cp-purchase-facts">
        <div><dt>Order total</dt><dd>{total == null ? "Not read" : dollars(total)}</dd></div>
        <div><dt>Property</dt><dd>{detail.property}</dd></div>
        <div><dt>Cleaner app item</dt><dd>{detail.item}{detail.category ? ` · ${detail.category}` : ""} · {left}{threshold} left</dd></div>
        <div><dt>Ships to</dt><dd>{detail.shipTo || "Not read"}</dd></div>
      </dl>
      {purchase.kind === "failed" ? (
        <p className="cp-purchase-bad">{failedCopy(purchase.reason)}</p>
      ) : detail.missing ? (
        <p className="cp-purchase-bad">{detail.missing} Nothing was ordered.</p>
      ) : (
        <p className="cp-purchase-wait">Not bought yet. Nothing is ordered until you press Purchase item.</p>
      )}
      {busy && purchase.kind === "detail" && detail.canBuy ? (
        <p className="cp-purchase-wait">Placing the order with {detail.retailer}</p>
      ) : purchase.kind === "failed" ? (
        finding ? (
          <form
            className="cp-purchase-alt"
            onSubmit={(e) => {
              e.preventDefault();
              const cents = price.trim() === "" ? null : Math.round(Number(price) * 100);
              onAlternative({
                productName,
                retailer,
                priceCents: cents != null && Number.isFinite(cents) ? cents : null,
                imageUrl,
                productUrl,
              });
            }}
          >
            <input aria-label="Product" placeholder="Product" value={productName} onChange={(e) => setProductName(e.target.value)} />
            <input aria-label="Retailer" placeholder="Retailer" value={retailer} onChange={(e) => setRetailer(e.target.value)} />
            <input aria-label="Price" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} />
            <input aria-label="Image URL" placeholder="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            <input aria-label="Product URL" placeholder="Product URL" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} />
            <button type="submit" className="cp-send" disabled={busy}>Review this product</button>
          </form>
        ) : (
          <div className="cp-actions">
            <button type="button" className="cp-send" disabled={busy} onClick={() => setFinding(true)}>Find an alternative</button>
            <button type="button" className="cp-hold" disabled={busy} onClick={onSkip}>Skip</button>
          </div>
        )
      ) : detail.canBuy ? (
        <div className="cp-actions">
          <button type="button" className="cp-send" disabled={busy} onClick={() => onPurchase(shownQty)}>Purchase item</button>
          <button type="button" className="cp-hold" disabled={busy} onClick={onNotNow}>Not now</button>
        </div>
      ) : (
        <div className="cp-actions">
          <button type="button" className="cp-hold" disabled={busy} onClick={onNotNow}>Not now</button>
        </div>
      )}
    </div>
  );
}
