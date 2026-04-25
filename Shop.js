/* ───────────────────────────────────────────
   NegotiMart — Shop & Cart Logic
   ─────────────────────────────────────────── */

// ── State
let products    = [];
let nextId      = 9999;
let activeFilter = 'All';
let cart        = [];
let soldOutIds  = JSON.parse(localStorage.getItem('soldOutIds') || '[]');

// ── Cart helpers
const cartTotal = () => cart.reduce((s, i) => s + i.finalPrice * i.qty, 0);
const cartQty   = () => cart.reduce((s, i) => s + i.qty, 0);

function updateCartBadge() {
  document.getElementById('cart-count').textContent = cartQty();
}

function saveSoldOut() {
  localStorage.setItem('soldOutIds', JSON.stringify(soldOutIds));
}

// ── Boot: load products from the Python backend
async function initShop() {
  document.getElementById('products').innerHTML =
    `<div class="loading-state">⏳ Loading products... (first load may take 30s while server wakes up)</div>`;

  let attempts = 0;
  while (attempts < 3) {
    try {
      const res = await fetch(`${API_BASE}/products?limit=520`);
      if (!res.ok) throw new Error('Bad response');
      const data = await res.json();

      // Normalise field names from the API into flat local objects
      products = data.products.map(p => ({
        ...p,
        id:       p.product_id,
        name:     p.product_name,
        price:    p.selling_price,
        original: p.original_price,
        min:      p.min_acceptable_price,   // ← used by AI system prompt
        discount: p.discount_percent,
        reviews:  p.num_reviews,
        stock:    p.stock_quantity,
        image:    p.image || getProductImage(p.product_name) || null,
      }));

      if (products.length > 0) {
        renderFilters();
        renderProducts();
        return;
      }
      throw new Error('No products');

    } catch (e) {
      attempts++;
      if (attempts < 3) {
        document.getElementById('products').innerHTML =
          `<div class="loading-state">⏳ Still loading... retrying (${attempts}/3). Server waking up, please wait...</div>`;
        await new Promise(r => setTimeout(r, 5000));
      } else {
        document.getElementById('products').innerHTML =
          `<div class="loading-state" style="display:flex;flex-direction:column;align-items:center;gap:1rem">
            <span>❌ Could not load products.</span>
            <button class="btn-primary" onclick="initShop()">🔄 Try Again</button>
          </div>`;
      }
    }
  }
}

// ── Filter bar
function getCategories() {
  return ['All', ...new Set(products.map(p => p.category))];
}

function renderFilters() {
  document.getElementById('filters').innerHTML = getCategories()
    .map(c => `<button class="filter-btn ${c === activeFilter ? 'active' : ''}" onclick="setFilter('${c}')">${c}</button>`)
    .join('');
}

function setFilter(cat) {
  activeFilter = cat;
  renderFilters();
  renderProducts();
}

// ── Product grid
function renderProducts() {
  const list = activeFilter === 'All' ? products : products.filter(p => p.category === activeFilter);

  document.getElementById('products').innerHTML = list.map(p => {
    const imgHTML = p.image
      ? `<img src="${p.image}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
         <div class="product-img-placeholder" style="display:none">${svgPlaceholder()}</div>`
      : `<div class="product-img-placeholder">${svgPlaceholder()}</div>`;

    const soldOut = soldOutIds.includes(p.id);
    const btnsHTML = soldOut
      ? `<button disabled style="flex:1;background:rgba(255,107,107,.1);border:1px solid rgba(255,107,107,.3);color:var(--red);padding:8px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:not-allowed">❌ Sold Out</button>`
      : `<button class="add-cart-btn" onclick="addToCart(${p.id})">🛒 Add to Cart</button>
         ${p.negotiable ? `<button class="negotiate-btn" onclick="openNegotiateModal(${p.id})">💬 Negotiate</button>` : ''}`;

    return `
      <div class="product-card">
        <div class="product-img-wrap">${imgHTML}</div>
        <div class="product-info">
          <div class="product-category">${p.category}</div>
          <div class="product-name">${p.name}</div>
          <div class="product-pricing">
            <span class="price-current">${GHS(p.price)}</span>
            <span class="price-original">${GHS(p.original)}</span>
            <span class="discount-badge">-${p.discount}%</span>
          </div>
          <div class="product-meta">
            <span class="stars">${'★'.repeat(Math.floor(p.rating))}${'☆'.repeat(5 - Math.floor(p.rating))}</span>
            <span class="reviews">(${p.reviews.toLocaleString()})</span>
            ${p.negotiable ? '<span class="negotiable-tag">Negotiable</span>' : ''}
          </div>
          <div class="product-btns">${btnsHTML}</div>
        </div>
      </div>`;
  }).join('');
}

function svgPlaceholder() {
  return `<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <path d="M21 15l-5-5L5 21"/>
  </svg>`;
}

// ── Cart
function addToCart(id, finalPrice = null, note = null) {
  const p     = products.find(x => x.id === id);
  const price = finalPrice || p.price;
  const existing = cart.find(x => x.id === id && x.finalPrice === price);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, name: p.name, image: p.image, category: p.category, finalPrice: price, originalPrice: p.price, note, qty: 1 });
  }
  updateCartBadge();
  showToast(note ? 'Negotiated price added to cart!' : `${p.name} added to cart!`);
}

function openCart() {
  const itemsHTML = cart.length === 0
    ? `<div class="empty-cart"><div style="font-size:3rem;margin-bottom:1rem">🛒</div><p>Your cart is empty.</p></div>`
    : `<div class="cart-items">
        ${cart.map((item, i) => `
          <div class="cart-item">
            ${item.image
              ? `<img src="${item.image}" class="cart-item-img" onerror="this.style.display='none'">`
              : `<div class="cart-item-img-ph">IMG</div>`}
            <div class="cart-item-info">
              <div class="cart-item-name">${item.name}</div>
              <div class="cart-item-price">${GHS(item.finalPrice)}</div>
              ${item.note ? `<div class="cart-item-note">✓ Negotiated price</div>` : ''}
            </div>
            <div class="cart-item-controls">
              <button class="qty-btn" onclick="changeQty(${i},-1)">−</button>
              <span class="qty-num">${item.qty}</span>
              <button class="qty-btn" onclick="changeQty(${i},1)">+</button>
              <button class="remove-btn" onclick="removeItem(${i})">×</button>
            </div>
          </div>`).join('')}
      </div>
      <div class="cart-footer">
        <div class="cart-summary">
          <div class="cart-row"><span style="color:var(--muted)">Subtotal</span><span>${GHS(cartTotal())}</span></div>
          <div class="cart-row"><span style="color:var(--muted)">Delivery</span><span style="color:var(--green)">Free</span></div>
          <div class="cart-row total"><span>Total</span><span style="color:var(--accent)">${GHS(cartTotal())}</span></div>
        </div>
        <button class="btn-primary" style="width:100%;padding:14px;font-size:15px" onclick="openCheckout()">Proceed to Checkout →</button>
      </div>`;

  document.getElementById('modal-container').innerHTML =
    `<div class="modal-overlay" onclick="handleOverlay(event)">
      <div class="modal modal-cart">
        <div class="modal-header">
          <h3>🛒 Your Cart (${cartQty()} items)</h3>
          <button class="close-btn" onclick="closeModal()">✕</button>
        </div>
        ${itemsHTML}
      </div>
    </div>`;
}

function changeQty(i, delta) {
  cart[i].qty += delta;
  if (cart[i].qty <= 0) cart.splice(i, 1);
  updateCartBadge();
  openCart();
}

function removeItem(i) {
  cart.splice(i, 1);
  updateCartBadge();
  openCart();
}

// ── Checkout
function getPaymentHTML(val) {
  const total  = GHS(cartTotal());
  const isMomo = ['MTN Mobile Money','Vodafone Cash','AirtelTigo Money'].includes(val);
  const isBank = val === 'Bank Transfer';
  const isPOD  = val === 'Pay on Delivery';

  if (isPOD)  return `<div class="pod-box"><p>💳 You will pay <strong style="color:var(--accent)">${total}</strong> cash upon delivery. Our team will contact you to confirm.</p></div>`;
  if (isBank) return `<div class="payment-instructions"><h2>Complete Purchase</h2>
    <p>1. Transfer <b>${total}</b> to GCB Bank — Acc: <b>1234567890</b> (NegotiMart Ltd)</p>
    <p>2. Copy your bank <b>Transaction / Reference ID</b> from the receipt.</p>
    <p>3. Fill the form below with your delivery info.</p></div>
    <div class="form-group" style="margin-top:.75rem"><label>Bank Transaction / Reference ID</label><input id="co-txn" placeholder="e.g. TXN-2024-XXXXXX"/></div>`;
  if (isMomo) return `<div class="payment-instructions"><h2>Complete Purchase</h2>
    <p>1. Send payment to MTN MoMo <b>${MOMO_NUMBER}</b> (NegotiMart)</p>
    <p>2. Copy the Transaction ID from SMS.</p>
    <p>3. Fill the form below with your delivery info.</p></div>
    <div class="form-group" style="margin-top:.75rem"><label>MoMo Transaction ID</label><input id="co-txn" placeholder="e.g. 1234567890"/></div>`;
  return '';
}

function openCheckout() {
  document.getElementById('modal-container').innerHTML =
    `<div class="modal-overlay" onclick="handleOverlay(event)">
      <div class="modal modal-checkout">
        <div class="modal-header"><h3>Checkout</h3><button class="close-btn" onclick="openCart()">←</button></div>
        <div class="checkout-body">
          <div class="checkout-section">
            <h4>Payment Method</h4>
            <div class="form-group">
              <label>Select Payment</label>
              <select id="co-payment" onchange="document.getElementById('payment-detail').innerHTML=getPaymentHTML(this.value)">
                <option>MTN Mobile Money</option>
                <option>Vodafone Cash</option>
                <option>AirtelTigo Money</option>
                <option>Bank Transfer</option>
                <option>Pay on Delivery</option>
              </select>
            </div>
            <div id="payment-detail">${getPaymentHTML('MTN Mobile Money')}</div>
          </div>
          <div class="checkout-section">
            <h4>Delivery Information</h4>
            <div class="form-group"><label>Full Name</label><input id="co-name" placeholder="Kwame Mensah"/></div>
            <div class="form-group"><label>Phone Number</label><input id="co-phone" placeholder="024 000 0000"/></div>
            <div class="form-group"><label>Email Address</label><input id="co-email" type="email" placeholder="kwame@email.com"/></div>
            <div class="form-group"><label>Delivery Address</label><input id="co-address" placeholder="House No. 12, Accra"/></div>
            <div class="form-row-2">
              <div class="form-group"><label>City</label><input id="co-city" placeholder="Accra"/></div>
              <div class="form-group"><label>Region</label>
                <select id="co-region">
                  <option>Greater Accra</option><option>Ashanti</option><option>Western</option>
                  <option>Central</option><option>Eastern</option><option>Northern</option>
                  <option>Volta</option><option>Brong-Ahafo</option><option>Upper East</option>
                  <option>Upper West</option><option>Oti</option><option>Bono East</option>
                  <option>Ahafo</option><option>Savannah</option><option>North East</option>
                  <option>Western North</option>
                </select>
              </div>
            </div>
          </div>
          <div class="checkout-section">
            <h4>Order Summary</h4>
            ${cart.map(item => `<div class="order-line"><span>${item.name} × ${item.qty}</span><span>${GHS(item.finalPrice * item.qty)}</span></div>`).join('')}
            <div class="checkout-total-row"><span>Total</span><span style="color:var(--accent)">${GHS(cartTotal())}</span></div>
          </div>
        </div>
        <div class="checkout-footer">
          <button class="btn-primary" style="width:100%;padding:14px;font-size:15px" onclick="placeOrder()">Place Order — ${GHS(cartTotal())}</button>
        </div>
      </div>
    </div>`;
}

async function placeOrder() {
  const name    = document.getElementById('co-name').value.trim();
  const phone   = document.getElementById('co-phone').value.trim();
  const address = document.getElementById('co-address').value.trim();
  const payment = document.getElementById('co-payment').value;
  const txn     = document.getElementById('co-txn')?.value.trim() || '';

  if (!name || !phone || !address) { alert('Please fill in your name, phone, and address.'); return; }
  if (payment !== 'Pay on Delivery' && !txn) { alert('Please enter your Transaction ID to confirm payment.'); document.getElementById('co-txn')?.focus(); return; }

  const ref   = genRef();
  const order = {
    ref, name, phone,
    email:   document.getElementById('co-email').value,
    address,
    city:    document.getElementById('co-city').value,
    region:  document.getElementById('co-region').value,
    payment, txn_id: txn,
    total:   cartTotal(),
    items:   cart.map(i => ({ name: i.name, qty: i.qty, price: i.finalPrice, negotiated: !!i.note, id: i.id })),
    date:    new Date().toLocaleString('en-GH'),
    status:  'New'
  };

  orders.unshift(order);
  saveOrders();

  // Save to backend
  try {
    await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order)
    });
  } catch (e) { console.error(e); }

  // Update stock
  cart.forEach(i => {
    const product = products.find(p => p.id === i.id);
    if (product) {
      product.stock = Math.max(0, product.stock - i.qty);
      if (product.stock === 0 && !soldOutIds.includes(i.id)) soldOutIds.push(i.id);
    }
  });
  saveSoldOut();

  cart = [];
  updateCartBadge();

  // WhatsApp notification
  const itemsList = order.items.map(i => `  - ${i.name} x${i.qty} @ ${GHS(i.price)}${i.negotiated ? ' [Negotiated]' : ''}`).join('\n');
  const waMsg = `*NEW ORDER -- NegotiMart*\n\n*Ref:* ${ref}\n*Customer:* ${name}\n*Phone:* ${phone}\n*Address:* ${order.address}, ${order.city}, ${order.region}\n*Payment:* ${payment}${txn ? ' -- Txn: ' + txn : ''}\n*Date:* ${order.date}\n\n*Items:*\n${itemsList}\n\n*Total: ${GHS(order.total)}*`;
  const waLink = document.createElement('a');
  waLink.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`;
  waLink.target = '_blank'; waLink.rel = 'noopener';
  document.body.appendChild(waLink); waLink.click(); document.body.removeChild(waLink);

  document.getElementById('modal-container').innerHTML =
    `<div class="modal-overlay">
      <div class="modal modal-success">
        <div class="success-body">
          <div class="success-icon">✓</div>
          <h3>Order Placed!</h3>
          <p>Thank you, ${name}! Your order has been received${txn ? ` — Txn ID: <strong style="color:var(--accent)">${txn}</strong>` : ''}. We'll contact you on ${phone} shortly.</p>
          <div class="order-ref">Order Ref: ${ref}</div>
          <button class="btn-primary" style="margin-top:.5rem" onclick="closeModal()">Continue Shopping</button>
        </div>
      </div>
    </div>`;
}