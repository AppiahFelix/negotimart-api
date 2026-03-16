from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import math
import os

app = FastAPI(title="NegotiMart API", version="1.0.0")

# Allow all origins so your frontend can call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

CSV_PATH = os.getenv("CSV_PATH", "products_dataset_ghs.csv")

def load_products():
    df = pd.read_csv(CSV_PATH)
    # Clean up column names (strip whitespace)
    df.columns = df.columns.str.strip()
    # Replace NaN with None
    df = df.where(pd.notnull(df), None)
    return df

def row_to_dict(row):
    return {
        "product_id":           int(row["product_id"]),
        "product_name":         str(row["product_name"]),
        "category":             str(row["category"]),
        "brand":                str(row["brand"]),
        "condition":            str(row["condition"]),
        "original_price":       round(float(row["original_price_ghs"]), 2),
        "selling_price":        round(float(row["selling_price_ghs"]), 2),
        "min_acceptable_price": round(float(row["min_acceptable_price_ghs"]), 2),
        "discount_percent":     int(row["discount_percent"]),
        "stock_quantity":       int(row["stock_quantity"]),
        "rating":               round(float(row["rating"]), 1),
        "num_reviews":          int(row["num_reviews"]),
        "negotiable":           str(row["negotiable"]).strip().lower() == "yes",
        "currency":             "GHS",
        "image":                None,  # image URLs managed on frontend
    }


# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "NegotiMart API is running ✅", "docs": "/docs"}


@app.get("/products")
def get_products(
    category: Optional[str] = Query(None, description="Filter by category"),
    negotiable: Optional[bool] = Query(None, description="Filter negotiable products"),
    search: Optional[str] = Query(None, description="Search by product name"),
    min_price: Optional[float] = Query(None, description="Minimum selling price (GHS)"),
    max_price: Optional[float] = Query(None, description="Maximum selling price (GHS)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
):
    """Get all products with optional filtering and pagination."""
    df = load_products()

    if category:
        df = df[df["category"].str.lower() == category.lower()]
    if negotiable is not None:
        mask = df["negotiable"].str.strip().str.lower() == "yes"
        df = df[mask] if negotiable else df[~mask]
    if search:
        df = df[df["product_name"].str.lower().str.contains(search.lower(), na=False)]
    if min_price is not None:
        df = df[df["selling_price_ghs"] >= min_price]
    if max_price is not None:
        df = df[df["selling_price_ghs"] <= max_price]

    total = len(df)
    total_pages = math.ceil(total / limit)
    start = (page - 1) * limit
    end = start + limit
    page_df = df.iloc[start:end]

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "products": [row_to_dict(row) for _, row in page_df.iterrows()],
    }


@app.get("/products/{product_id}")
def get_product(product_id: int):
    """Get a single product by ID."""
    df = load_products()
    row = df[df["product_id"] == product_id]
    if row.empty:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
    return row_to_dict(row.iloc[0])


@app.get("/categories")
def get_categories():
    """Get all unique product categories."""
    df = load_products()
    categories = sorted(df["category"].dropna().unique().tolist())
    return {"categories": categories}


@app.get("/products/category/{category}")
def get_by_category(category: str, page: int = 1, limit: int = 20):
    """Get products by category."""
    return get_products(category=category, page=page, limit=limit)


@app.get("/stats")
def get_stats():
    """Get store statistics."""
    df = load_products()
    negotiable_count = (df["negotiable"].str.strip().str.lower() == "yes").sum()
    return {
        "total_products":     len(df),
        "total_categories":   df["category"].nunique(),
        "negotiable_products": int(negotiable_count),
        "avg_selling_price":  round(float(df["selling_price_ghs"].mean()), 2),
        "avg_discount":       round(float(df["discount_percent"].mean()), 1),
        "currency":           "GHS",
    }


# Pydantic model for negotiation price check
class NegotiationCheck(BaseModel):
    product_id: int
    offered_price: float

@app.post("/negotiate/check")
def check_offer(body: NegotiationCheck):
    """
    Check if an offered price is acceptable.
    Returns whether to accept, reject, or counter-offer.
    The min_acceptable_price is never exposed — only the decision.
    """
    df = load_products()
    row = df[df["product_id"] == body.product_id]
    if row.empty:
        raise HTTPException(status_code=404, detail="Product not found")

    product = row.iloc[0]
    selling_price = float(product["selling_price_ghs"])
    min_price = float(product["min_acceptable_price_ghs"])
    offered = body.offered_price

    if offered >= selling_price:
        return {"decision": "accept", "final_price": selling_price, "message": "Great, full price accepted!"}
    elif offered >= min_price:
        return {"decision": "accept", "final_price": round(offered, 2), "message": "Deal accepted!"}
    else:
        # Counter-offer at midpoint between offer and selling price
        counter = round((offered + selling_price) / 2, 2)
        counter = max(counter, min_price)
        return {
            "decision": "counter",
            "counter_price": counter,
            "message": f"We can offer GH₵{counter:,.2f}"
        }
