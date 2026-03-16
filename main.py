from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import csv
import math
import os

app = FastAPI(title="NegotiMart API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.getenv("CSV_PATH", os.path.join(BASE_DIR, "products_dataset_ghs.csv"))

def load_products():
    products = []
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                products.append({
                    "product_id":           int(row["product_id"]),
                    "product_name":         row["product_name"].strip(),
                    "category":             row["category"].strip(),
                    "brand":                row["brand"].strip(),
                    "condition":            row["condition"].strip(),
                    "original_price":       round(float(row["original_price_ghs"]), 2),
                    "selling_price":        round(float(row["selling_price_ghs"]), 2),
                    "min_acceptable_price": round(float(row["min_acceptable_price_ghs"]), 2),
                    "discount_percent":     int(float(row["discount_percent"])),
                    "stock_quantity":       int(float(row["stock_quantity"])),
                    "rating":               round(float(row["rating"]), 1),
                    "num_reviews":          int(float(row["num_reviews"])),
                    "negotiable":           row["negotiable"].strip().lower() == "yes",
                    "currency":             "GHS",
                    "image":                None,
                })
            except Exception:
                continue
    return products


@app.get("/")
def root():
    return {"message": "NegotiMart API is running ✅", "docs": "/docs"}


@app.get("/products")
def get_products(
    category: Optional[str] = Query(None),
    negotiable: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
):
    products = load_products()

    if category:
        products = [p for p in products if p["category"].lower() == category.lower()]
    if negotiable is not None:
        products = [p for p in products if p["negotiable"] == negotiable]
    if search:
        products = [p for p in products if search.lower() in p["product_name"].lower()]
    if min_price is not None:
        products = [p for p in products if p["selling_price"] >= min_price]
    if max_price is not None:
        products = [p for p in products if p["selling_price"] <= max_price]

    total = len(products)
    total_pages = math.ceil(total / limit)
    start = (page - 1) * limit
    end = start + limit

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "products": products[start:end],
    }


@app.get("/products/{product_id}")
def get_product(product_id: int):
    products = load_products()
    for p in products:
        if p["product_id"] == product_id:
            return p
    raise HTTPException(status_code=404, detail=f"Product {product_id} not found")


@app.get("/categories")
def get_categories():
    products = load_products()
    cats = sorted(set(p["category"] for p in products))
    return {"categories": cats}


@app.get("/stats")
def get_stats():
    products = load_products()
    neg = sum(1 for p in products if p["negotiable"])
    avg_price = round(sum(p["selling_price"] for p in products) / len(products), 2) if products else 0
    avg_discount = round(sum(p["discount_percent"] for p in products) / len(products), 1) if products else 0
    cats = set(p["category"] for p in products)
    return {
        "total_products": len(products),
        "total_categories": len(cats),
        "negotiable_products": neg,
        "avg_selling_price": avg_price,
        "avg_discount": avg_discount,
        "currency": "GHS",
    }


class NegotiationCheck(BaseModel):
    product_id: int
    offered_price: float

@app.post("/negotiate/check")
def check_offer(body: NegotiationCheck):
    products = load_products()
    product = next((p for p in products if p["product_id"] == body.product_id), None)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    selling_price = product["selling_price"]
    min_price = product["min_acceptable_price"]
    offered = body.offered_price

    if offered >= selling_price:
        return {"decision": "accept", "final_price": selling_price, "message": "Great, full price accepted!"}
    elif offered >= min_price:
        return {"decision": "accept", "final_price": round(offered, 2), "message": "Deal accepted!"}
    else:
        counter = round((offered + selling_price) / 2, 2)
        counter = max(counter, min_price)
        return {"decision": "counter", "counter_price": counter, "message": f"We can offer GH₵{counter:,.2f}"}
