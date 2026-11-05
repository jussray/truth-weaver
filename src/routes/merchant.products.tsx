import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { authed } from "@/lib/merchant/authed-call";
import { confirmationPhrase, requiresTypedConfirmation, validatePrice } from "@/lib/merchant/policy";
import {
  listMerchantProducts,
  updateVariantPrice,
  type MerchantProduct,
  type MerchantVariant,
} from "@/lib/merchant/portal.functions";

export const Route = createFileRoute("/merchant/products")({
  head: () => ({ meta: [{ title: "Products | Truth Weaver Merchant" }, { name: "description", content: "Edit Truth Weaver product prices with confirmation and audit." }, { property: "og:title", content: "Products | Truth Weaver Merchant" }, { property: "og:description", content: "Product price management with confirmation and audit." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ProductsPage,
});

type Pending = { product: MerchantProduct; variant: MerchantVariant; price: string };

function ProductsPage() {
  const [products, setProducts] = useState<MerchantProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    authed(listMerchantProducts)
      .then((r) => { setProducts(r.products); setError(r.error); })
      .catch(() => setError("Products could not be loaded."));
  }, []);
  useEffect(load, [load]);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      const r = await authed(updateVariantPrice, {
        productId: pending.product.id,
        variantId: pending.variant.id,
        price: pending.price,
        confirmation: typed || undefined,
      });
      setNotice({ ok: r.ok, text: r.message });
      if (r.ok) { setPending(null); setTyped(""); load(); }
    } catch {
      setNotice({ ok: false, text: "The change could not be sent. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  }

  const strict = pending ? requiresTypedConfirmation(pending.variant.price, pending.price) : false;
  const phrase = pending ? confirmationPhrase("price", pending.variant.id, pending.price) : "";

  return (
    <section aria-labelledby="products-h">
      <h1 id="products-h" className="font-serif text-3xl">Products</h1>
      <p className="mt-1 text-sm text-parchment/60">Draft offers stay on launch hold; this page edits prices only.</p>

      {notice && (
        <div data-testid="price-notice" role={notice.ok ? "status" : "alert"} className={`mt-4 rounded-lg border p-3 text-sm ${notice.ok ? "border-ok/50 text-ok" : "border-danger/50 text-danger"}`}>
          {notice.text}
        </div>
      )}
      {error && <div role="alert" className="mt-4 rounded-lg border border-warn/50 p-3 text-sm text-warn">{error}</div>}
      {!products && !error && <p role="status" className="mt-6 text-parchment/60">Loading products…</p>}
      {products && products.length === 0 && !error && <p className="mt-6 text-parchment/60">No products found in the store.</p>}

      <div className="mt-6 grid gap-4">
        {products?.map((p) => (
          <article key={p.id} className="rounded-xl border border-gold/15 bg-forest-deep/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-xl">{p.title}</h2>
              <span className="rounded-full border border-gold/30 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gold">{p.status}</span>
            </div>
            <ul className="mt-3 divide-y divide-gold/10">
              {p.variants.map((v) => {
                const draft = drafts[v.id] ?? v.price;
                const valid = validatePrice(draft) && draft !== v.price;
                return (
                  <li key={v.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="min-w-40 flex-1 text-sm">{v.title}{v.sku ? <span className="text-parchment/50"> · {v.sku}</span> : null}</span>
                    <label className="flex items-center gap-2 text-sm">
                      <span className="text-parchment/60">Price $</span>
                      <input
                        aria-label={`Price for ${p.title} ${v.title}`}
                        inputMode="decimal"
                        value={draft}
                        onChange={(e) => setDrafts((d) => ({ ...d, [v.id]: e.currentTarget.value }))}
                        className="w-28 rounded-md border border-gold/25 bg-ink px-2 py-1.5 text-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!valid}
                      onClick={() => { setTyped(""); setNotice(null); setPending({ product: p, variant: v, price: draft }); }}
                      className="rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-ink disabled:opacity-40"
                    >
                      Review change
                    </button>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </div>

      {pending && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-h" className="fixed inset-0 z-50 grid place-items-center bg-ink/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gold/30 bg-forest-deep p-6">
            <h2 id="confirm-h" className="font-serif text-2xl">Confirm price change</h2>
            <p className="mt-2 text-sm text-parchment/70">{pending.product.title} — {pending.variant.title}</p>
            <p data-testid="price-diff" className="mt-4 text-lg">
              <span className="text-parchment/60 line-through">${pending.variant.price}</span> → <strong className="text-gold">${pending.price}</strong>
            </p>
            {strict && (
              <label className="mt-4 block text-sm">
                <span className="text-warn">Large change. Type <code className="rounded bg-ink px-1">{phrase}</code> to confirm.</span>
                <input
                  aria-label="Confirmation phrase"
                  value={typed}
                  onChange={(e) => setTyped(e.currentTarget.value)}
                  className="mt-2 w-full rounded-md border border-gold/25 bg-ink px-2 py-1.5"
                />
                <button type="button" onClick={() => setTyped(phrase)} className="mt-2 text-xs text-gold underline">Fill phrase</button>
              </label>
            )}
            {notice && !notice.ok && <p role="alert" className="mt-3 text-sm text-danger">{notice.text}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPending(null)} className="rounded-full border border-gold/40 px-4 py-2 text-sm">Cancel</button>
              <button
                type="button"
                disabled={busy || (strict && typed !== phrase)}
                onClick={confirm}
                className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
              >
                {busy ? "Saving…" : "Confirm change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
