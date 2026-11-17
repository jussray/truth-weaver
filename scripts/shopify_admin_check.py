#!/usr/bin/env python3
"""
Truth Weaver — Shopify Access Diagnostics & Verification Utility

Safely verifies Shopify Storefront and Admin API connectivity for
fcr-truth-weaver-esimv-203acj81.myshopify.com without exposing secrets.
"""

import os
import sys
import re
import json
import urllib.request
import urllib.error

STORE_DOMAIN = os.environ.get("SHOPIFY_STORE_DOMAIN", "fcr-truth-weaver-esimv-203acj81.myshopify.com")
STOREFRONT_TOKEN = os.environ.get("SHOPIFY_STOREFRONT_TOKEN")
if not STOREFRONT_TOKEN:
    shopify_ts = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "shopify.ts")
    if os.path.exists(shopify_ts):
        with open(shopify_ts, "r", encoding="utf-8") as f:
            m = re.search(r'SHOPIFY_STOREFRONT_TOKEN\s*=\s*"([^"]+)"', f.read())
            if m:
                STOREFRONT_TOKEN = m.group(1)

API_VERSION = "2026-10"


def check_storefront():
    """Checks public Storefront API connectivity and published product count."""
    if not STOREFRONT_TOKEN:
        return {"ok": False, "error": "SHOPIFY_STOREFRONT_TOKEN is not configured."}

    url = f"https://{STORE_DOMAIN}/api/{API_VERSION}/graphql.json"
    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    }
    query = """{
      shop { name primaryDomain { url } }
      products(first: 20) {
        edges {
          node {
            id title handle
            variants(first: 5) {
              edges { node { id title availableForSale price { amount currencyCode } } }
            }
          }
        }
      }
    }"""
    req = urllib.request.Request(url, data=json.dumps({"query": query}).encode("utf-8"), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8")).get("data", {})
            shop = data.get("shop", {})
            products = data.get("products", {}).get("edges", [])
            return {
                "ok": True,
                "shop_name": shop.get("name"),
                "primary_domain": shop.get("primaryDomain", {}).get("url"),
                "product_count": len(products),
                "products": [
                    {
                        "title": p["node"]["title"],
                        "handle": p["node"]["handle"],
                        "variants_count": len(p["node"]["variants"]["edges"]),
                    }
                    for p in products
                ],
            }
    except Exception as e:
        return {"ok": False, "error": str(e)}


def check_admin():
    """Checks Shopify Admin API token connectivity if configured."""
    admin_token = os.environ.get("SHOPIFY_ADMIN_ACCESS_TOKEN") or os.environ.get("SHOPIFY_ACCESS_TOKEN")
    if not admin_token:
        return {
            "ok": False,
            "configured": False,
            "message": "SHOPIFY_ADMIN_ACCESS_TOKEN is not configured in environment.",
        }

    url = f"https://{STORE_DOMAIN}/admin/api/{API_VERSION}/graphql.json"
    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": admin_token,
    }
    query = "{ shop { id name myshopifyDomain } }"
    req = urllib.request.Request(url, data=json.dumps({"query": query}).encode("utf-8"), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8")).get("data", {})
            shop = data.get("shop", {})
            return {
                "ok": True,
                "configured": True,
                "shop_id": shop.get("id"),
                "shop_name": shop.get("name"),
            }
    except urllib.error.HTTPError as e:
        return {
            "ok": False,
            "configured": True,
            "status_code": e.code,
            "error": "HTTP authentication failure",
        }
    except Exception as e:
        return {"ok": False, "configured": True, "error": str(e)}


def main():
    print("=== Truth Weaver Shopify Access Diagnostics ===")
    print(f"Target Store Domain: {STORE_DOMAIN}")

    sf = check_storefront()
    print("\n[Storefront API]")
    if sf["ok"]:
        print(f"  Status: CONNECTED (HTTP 200)")
        print(f"  Shop Name: {sf['shop_name']}")
        print(f"  Primary Domain: {sf['primary_domain']}")
        print(f"  Published Products Visible: {sf['product_count']}")
        for p in sf["products"]:
            print(f"    - {p['title']} ({p['handle']})")
    else:
        print(f"  Status: FAILED ({sf.get('error')})")

    adm = check_admin()
    print("\n[Admin API]")
    if not adm["configured"]:
        print(f"  Status: PENDING CONFIGURATION ({adm['message']})")
    elif adm["ok"]:
        print(f"  Status: CONNECTED (HTTP 200)")
        print(f"  Shop Name: {adm['shop_name']}")
    else:
        print(f"  Status: FAILED (Code {adm.get('status_code')}: {adm.get('error')})")


if __name__ == "__main__":
    main()
