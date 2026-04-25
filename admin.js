/* ───────────────────────────────────────────
   NegotiMart — Admin Panel
   ─────────────────────────────────────────── */

// ── State
let orders         = [];
let adminUnlocked  = false;
let imgTabMode     = 'url';
let pendingImageData = '';

try { orders = JSON.parse(localStorage.getItem('negotimart_orders') || '[]'); } catch (e) { orders = []; }

function saveOrders() {
  localStorage.setItem('negotimart_orders', JSON.stringify(orders));
}

// ── Tab switching (Shop ↔ Admin)
function switchTab(tab) {
  document.getElementById('view-shop').style.display  = tab === 'shop'  ? '' : 'none';
  document.getElementById('view-admin').style.display = tab === 'admin' ? '' : 'none';
  document.getElementById('tab-shop').classList.toggle('active',  tab === 'shop');
  document.getElementById('tab-admin').classList.toggle('active', tab === 'admin');
  if (tab === 'admin') { renderAdminStats(); renderAdminTable(); loadOrdersFromServer(); }
}

// ── Admin login
function openAdminLogin() {
  if (adminUnlocked) { switchTab('admin'); return; }
  document.getElementById('modal-container').innerHTML =
    `<div class="modal-overlay" onclick="handleOverlay(event)">
      <div class="modal modal-login">
        <div class="modal-header">
          <h3>🔒 Admin Access</h3>
          <button class="close-btn" onclick="closeModal()">✕</button>
        </div>
        <div class="login-body">
          <p>Enter the admin password to continue</p>
          <input class="login-input" id="admin-pw" type="password" placeholder="••••" maxlength="10" onkeydown="if(event.key==='Enter')checkAdminPw()"/>
          <div class="login-error" id="login-error">❌ Incorrect password. Try again.</div>
          <button class="btn-primary" style="width:100%;padding:12px" onclick="checkAdminPw()">Enter Admin</button>
        </div>
      </div>
    </div>`;
  setTimeout(() => document.getElementById('admin-pw')?.focus(), 100);
}

function checkAdminPw() {
  const pw = document.getElementById('admin-pw').value;
  if (pw === ADMIN_PASSWORD) {
    adminUnlocked = true;
    closeModal();
    switchTab('admin');
  } else {
    document.getElementById('login-error').style.display = 'block';
    document.getElementById('admin-pw').value = '';
    document.getElementById('admin-pw').focus();
  }
}

// ── Admin sub-tabs (Products / Orders)
function switchAdminTab(tab) {
  document.getElementById('admin-products-view').style.display = tab === 'products' ? '' : 'none';
  document.getElementById('admin-orders-view').style.display   = tab === 'orders'   ? '' : 'none';
  document.getElementById('atab-products').classList.toggle('active', tab === 'products');
  document.getElementById('atab-orders').classList.toggle('active',   tab === 'orders');
  if (tab === 'orders') loadOrdersFromServer();
}

// ── Load orders from the Python backend
async function loadOrdersFromServer() {
  const status = document.getElementById('orders-status');
  if (status) status.textContent = '⏳ Loading orders...';
  try {
    const res  = await fetch(`${API_BASE}/orders`);
    const data = await res.json();
    orders = data.orders || [];
    saveOrders();
    renderOrdersTable();
    renderAdminStats();
    if (status) status.textContent = `✅ ${orders.length} order(s) loaded from server`;
  } catch (e) {
    if (status) status.textContent = `❌ Failed to load: ${e.message}`;
    renderOrdersTable();
  }
}

// ── Stats cards
function renderAdminStats() {
  const total = products.length;
  const neg   = products.filter(p => p.negotiable).length;
  const low   = products.filter(p => p.stock < 15).length;
  document.getElementById('admin-stats').innerHTML =
    `<div class="stat-card"><div class="stat-label">Total Products</div><div class="stat-value">${total}</div></div>
     <div class="stat-card"><div class="stat-label">Negotiable</div><div class="stat-value" style="color:var(--green)">${neg}</div></div>
     <div class="stat-card"><div class="stat-label">Total Orders</div><div class="stat-value" style="color:var(--gold)">${orders.length}</div></div>
     <div class="stat-card"><div class="stat-label">Low Stock</div><div class="stat-value" style="color:var(--red)">${low}</div></div>`;
}

// ── Products table
function renderAdminTable() {
  const q = (document.getElementById('admin-search')?.value || '').toLowerCase();
  const list = products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  document.getElementById('admin-tbody').innerHTML = list.map(p =>
    `<tr>
      <td>${p.image ? `<img src="${p.image}" class="tbl-img" onerror="this.style.display='none'">` : `<div class="tbl-img-placeholder">—</div>`}</td>
      <td style="font-weight:500">${p.name}</td>
      <td style="color:var(--muted)">${p.category}</td>
      <td>${GHS(p.price)}</td>
      <td style="color:var(--muted)">${GHS(p.original)}</td>
      <td style="color:var(--accent)">${GHS(p.min)}</td>
      <td style="color:${p.stock < 15 ? 'var(--red)' : 'inherit'}">${p.stock}</td>
      <td><span class="${p.negotiable ? 'neg-yes' : 'neg-no'}">${p.negotiable ? 'Yes' : 'No'}</span></td>
      <td><div class="td-actions">
        <button class="btn-edit" onclick="openEditModal(${p.id})">Edit</button>
        <button class="btn-danger" onclick="deleteProduct(${p.id})">Delete</button>
      </div></td>
    </tr>`).join('');
}

// ── Orders table
function renderOrdersTable() {
  document.getElementById('orders-tbody').innerHTML = orders.length === 0
    ? `<tr><td colspan="10" style="text-align:center;padding:2rem;color:var(--muted)">No orders yet.</td></tr>`
    : orders.map((o, i) =>
      `<tr>
        <td style="color:var(--accent);font-weight:500">${o.ref}</td>
        <td style="font-weight:500">${o.name}</td>
        <td>${o.phone}</td>
        <td style="color:var(--muted)">${o.region}</td>
        <td style="color:var(--muted)">${o.payment}</td>
        <td style="color:var(--gold);font-size:12px;font-weight:500">${o.txn_id || '—'}</td>
        <td style="color:var(--green);font-weight:600">${GHS(o.total)}</td>
        <td style="font-size:12px">${o.items.map(it => `${it.name} ×${it.qty}${it.negotiated ? ' 🤝' : ''}`).join(', ')}</td>
        <td style="color:var(--muted);font-size:12px">${o.date}</td>
        <td>
          <select onchange="updateOrderStatus(${i},this.value)" style="background:var(--card);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:6px;font-family:'DM Sans',sans-serif;font-size:12px;outline:none">
            <option ${o.status==='New'?'selected':''}>New</option>
            <option ${o.status==='Processing'?'selected':''}>Processing</option>
            <option ${o.status==='Completed'?'selected':''}>Completed</option>
          </select>
        </td>
      </tr>`).join('');
}

function updateOrderStatus(i, status) {
  orders[i].status = status;
  saveOrders();
  fetch(`${API_BASE}/orders/${orders[i].ref}?status=${encodeURIComponent(status)}`, { method: 'PATCH' }).catch(e => console.error(e));
  renderAdminStats();
  showToast(`Order ${orders[i].ref} marked as ${status}`);
}

// ── Add / Edit product modal
function openAddModal()  { openFormModal(null); }
function openEditModal(id) { openFormModal(products.find(p => p.id === id)); }

function openFormModal(product) {
  const isEdit = !!product;
  imgTabMode       = 'url';
  pendingImageData = product?.image || '';
  const p = product || { name:'', category:'Electronics', image:'', price:'', original:'', min:'', stock:'', rating:'4.5', reviews:0, negotiable:true, discount:0 };
  const cats = ['Electronics','Sports','Home & Garden','Kitchen','Beauty','Clothing','Toys','Books'];

  document.getElementById('modal-container').innerHTML =
    `<div class="modal-overlay" onclick="handleOverlay(event)">
      <div class="modal modal-form">
        <div class="modal-header">
          <h3>${isEdit ? 'Edit Product' : 'Add New Product'}</h3>
          <button class="close-btn" onclick="closeModal()">✕</button>
        </div>
        <div class="form-body">
          <div class="img-input-group">
            <div style="font-size:12px;color:var(--muted);font-weight:500">Product Image</div>
            <div class="img-preview-box">
              <img id="img-preview-el" src="${p.image||''}" style="display:${p.image?'block':'none'}"/>
              <div class="img-preview-placeholder" id="img-placeholder" style="display:${p.image?'none':'flex'}">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                <span style="font-size:12px">Image preview</span>
              </div>
            </div>
            <div class="img-tabs">
              <button class="img-tab active" id="img-tab-url" onclick="switchImgTab('url')">🔗 Image URL</button>
              <button class="img-tab" id="img-tab-upload" onclick="switchImgTab('upload')">📁 Upload</button>
            </div>
            <div id="img-source-url">
              <input id="f-image-url" type="url" placeholder="https://example.com/product.jpg" value="${p.image||''}" oninput="previewFromUrl(this.value)" style="width:100%;background:var(--card);border:1px solid var(--border);color:var(--text);padding:10px 12px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;outline:none"/>
            </div>
            <div id="img-source-upload" style="display:none">
              <div class="upload-area">
                <input type="file" accept="image/*" onchange="handleFileUpload(event)"/>
                <div class="upload-area-text"><b>Click to upload</b><br><span style="font-size:11px">PNG, JPG, WEBP</span></div>
              </div>
            </div>
          </div>
          <div class="form-group"><label>Product Name</label><input id="f-name" value="${p.name}" placeholder="e.g. Samsung Galaxy A54"/></div>
          <div class="form-row">
            <div class="form-group"><label>Category</label>
              <select id="f-cat">${cats.map(c => `<option ${p.category===c?'selected':''}>${c}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Negotiable</label>
              <select id="f-neg">
                <option value="true"  ${p.negotiable  ? 'selected':''}>Yes</option>
                <option value="false" ${!p.negotiable ? 'selected':''}>No</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Selling Price (GH₵)</label><input id="f-price" type="number" value="${p.price}" placeholder="1200"/></div>
            <div class="form-group"><label>Original Price (GH₵)</label><input id="f-original" type="number" value="${p.original}" placeholder="1500"/></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label>Min Acceptable Price (GH₵)</label><input id="f-min" type="number" value="${p.min}" placeholder="950"/></div>
            <div class="form-group"><label>Stock Quantity</label><input id="f-stock" type="number" value="${p.stock}" placeholder="50"/></div>
          </div>
          <div class="form-group"><label>Rating (0–5)</label><input id="f-rating" type="number" step="0.1" min="0" max="5" value="${p.rating}"/></div>
        </div>
        <div class="form-footer">
          <button class="btn-cancel" onclick="closeModal()">Cancel</button>
          <button class="btn-primary" onclick="saveProduct(${isEdit ? p.id : 'null'})">${isEdit ? 'Save Changes' : 'Add Product'}</button>
        </div>
      </div>
    </div>`;
}

function switchImgTab(mode) {
  imgTabMode = mode;
  document.getElementById('img-tab-url').classList.toggle('active', mode === 'url');
  document.getElementById('img-tab-upload').classList.toggle('active', mode === 'upload');
  document.getElementById('img-source-url').style.display    = mode === 'url'    ? '' : 'none';
  document.getElementById('img-source-upload').style.display = mode === 'upload' ? '' : 'none';
}

function previewFromUrl(url) {
  pendingImageData = url;
  const el = document.getElementById('img-preview-el');
  const ph = document.getElementById('img-placeholder');
  if (url) {
    el.src = url; el.style.display = 'block';
    el.onerror = () => { el.style.display = 'none'; ph.style.display = 'flex'; };
    el.onload  = () => { ph.style.display = 'none'; };
  } else {
    el.style.display = 'none'; ph.style.display = 'flex';
  }
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    pendingImageData = ev.target.result;
    const el = document.getElementById('img-preview-el');
    const ph = document.getElementById('img-placeholder');
    el.src = pendingImageData; el.style.display = 'block'; ph.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function saveProduct(editId) {
  const name     = document.getElementById('f-name').value.trim();
  const price    = parseFloat(document.getElementById('f-price').value);
  const original = parseFloat(document.getElementById('f-original').value);
  const min      = parseFloat(document.getElementById('f-min').value);
  if (!name || !price || !original || !min) { alert('Please fill in name, prices and min price.'); return; }

  const finalImage = imgTabMode === 'url' ? (document.getElementById('f-image-url')?.value || '') : pendingImageData;
  const data = {
    name, price, original, min,
    image:      finalImage || getProductImage(name) || null,
    category:   document.getElementById('f-cat').value,
    stock:      parseInt(document.getElementById('f-stock').value) || 0,
    rating:     parseFloat(document.getElementById('f-rating').value) || 4.0,
    reviews:    editId ? products.find(p => p.id === editId).reviews : 0,
    negotiable: document.getElementById('f-neg').value === 'true',
    discount:   Math.round((1 - price / original) * 100),
    id:         editId || nextId++
  };

  if (editId) {
    const idx = products.findIndex(p => p.id === editId);
    products[idx] = { ...products[idx], ...data };
    showToast('Product updated!');
  } else {
    products.push(data);
    showToast('Product added!');
  }
  closeModal();
  renderAdminStats();
  renderAdminTable();
  renderFilters();
  renderProducts();
}

function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  products = products.filter(p => p.id !== id);
  renderAdminStats(); renderAdminTable(); renderFilters(); renderProducts();
  showToast('Product deleted');
}

async function resetStock() {
  if (!confirm('Reset all sold out products back to available?')) return;
  soldOutIds = [];
  saveSoldOut();
  renderProducts();
  renderAdminStats();
  showToast('✅ All products are now available again!');
}
