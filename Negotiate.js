/* ───────────────────────────────────────────
   NegotiMart — AI Negotiation Engine
   
   LEARNING PIPELINE:
   1. openNegotiateModal()  — locks in product, resets session tracking
   2. sendMsg()             — calls backend /negotiate/chat with region context.
                              Backend injects learned intelligence into system prompt.
   3. acceptDeal()          — records a WIN outcome to /negotiate/outcome
   4. closeModal()          — if no deal was made, records a LOSS outcome
   
   After 5+ sessions per product the AI starts using patterns.
   After 20+ sessions it becomes noticeably smarter.
   ─────────────────────────────────────────── */

// ── State
let currentProduct  = null;
let chatHistory     = [];
let isLoading       = false;

// ── Session tracking (for learning)
let sessionRounds      = 0;       // how many back-and-forth messages
let sessionFirstOffer  = null;    // customer's very first price offer
let sessionLastPrice   = null;    // last price mentioned in the chat
let sessionDealClosed  = false;   // did a deal happen this session
let sessionRegion      = "Unknown";

// ── Get customer region from checkout if already filled, else Unknown
function getCustomerRegion() {
  return document.getElementById('co-region')?.value || "Unknown";
}

// ── Get current time of day label
function getTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

// ── Extract a price number from a message string
function extractPrice(text) {
  const match = text.match(/GH[₵C]?\s*([\d,]+(?:\.\d+)?)/i) ||
                text.match(/(\d[\d,]*(?:\.\d+)?)/);
  if (match) return parseFloat(match[1].replace(/,/g, ''));
  return null;
}

// ── Record outcome to the backend learning database
async function recordOutcome(accepted, finalPrice) {
  try {
    await fetch(`${API_BASE}/negotiate/outcome`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        product_id:    currentProduct.id,
        accepted:      accepted,
        offered_price: sessionFirstOffer || currentProduct.price,
        final_price:   finalPrice,
        rounds:        sessionRounds,
        region:        sessionRegion,
        time_of_day:   getTimeOfDay(),
        first_offer:   sessionFirstOffer
      })
    });
  } catch (e) {
    console.error("Could not record outcome:", e);
  }
}

// ── Open the negotiation modal for a product
function openNegotiateModal(id) {
  currentProduct     = products.find(p => p.id === id);
  chatHistory        = [];
  sessionRounds      = 0;
  sessionFirstOffer  = null;
  sessionLastPrice   = currentProduct.price;
  sessionDealClosed  = false;
  sessionRegion      = getCustomerRegion();

  renderNegotiateModal();
  addMessage('ai',
    `Hi! I'm your AI sales agent for the **${currentProduct.name}**. ` +
    `It's listed at **${GHS(currentProduct.price)}** (was ${GHS(currentProduct.original)}). ` +
    `Make me an offer in GH₵ and let's find a deal!`
  );
}

// ── Build the chat modal HTML
function renderNegotiateModal() {
  const p = currentProduct;
  document.getElementById('modal-container').innerHTML =
    `<div class="modal-overlay" onclick="handleOverlay(event)">
      <div class="modal modal-neg">
        <div class="modal-header">
          <div style="display:flex;gap:12px;align-items:center">
            ${p.image ? `<img src="${p.image}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;border:1px solid var(--border)"/>` : ''}
            <div>
              <h3>${p.name}</h3>
              <span style="font-size:1.1rem;font-weight:600;color:var(--accent)">${GHS(p.price)}</span>
              <span style="font-size:12px;color:var(--muted);text-decoration:line-through;margin-left:6px">${GHS(p.original)}</span>
            </div>
          </div>
          <button class="close-btn" onclick="closeNegotiateModal()">✕</button>
        </div>
        <div class="chat-area" id="chat-area"></div>
        <div class="quick-offers">
          <span style="font-size:12px;color:var(--muted)">Quick offers:</span>
          <button class="quick-btn" onclick="sendQuick(10)">-10%</button>
          <button class="quick-btn" onclick="sendQuick(15)">-15%</button>
          <button class="quick-btn" onclick="sendQuick(20)">-20%</button>
          <button class="quick-btn" onclick="sendQuick(25)">-25%</button>
        </div>
        <div id="deal-banner"></div>
        <div class="chat-input-area">
          <input class="chat-input" id="chat-input"
            placeholder="Type your offer in GH₵..."
            onkeydown="if(event.key==='Enter')sendMsg()"/>
          <button class="send-btn" id="send-btn" onclick="sendMsg()">&#10148;</button>
        </div>
      </div>
    </div>`;
}

// ── Close negotiate modal — record rejection if no deal was made
function closeNegotiateModal() {
  if (currentProduct && !sessionDealClosed && sessionRounds > 0) {
    // Customer walked away — record as a loss
    recordOutcome(false, sessionLastPrice || currentProduct.price);
  }
  closeModal();
}

// ── Add a message bubble to the chat UI
function addMessage(role, text) {
  chatHistory.push({ role, text });
  const area = document.getElementById('chat-area');
  if (!area) return;

  const div = document.createElement('div');
  div.className = `msg ${role === 'ai' ? 'ai' : 'user'}`;
  div.innerHTML =
    `<div class="msg-label">${role === 'ai' ? 'AI Agent' : 'You'}</div>
     <div class="msg-bubble">${text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;

  // Check if a deal token is in this message
  const match = text.match(/DEAL_ACCEPTED:(\d+(?:\.\d+)?)/);
  if (match) showDealBanner(parseFloat(match[1]));
}

// ── Quick offer buttons
function sendQuick(pct) {
  const offer = Math.round(currentProduct.price * (1 - pct / 100));
  document.getElementById('chat-input').value =
    `I'd like to offer GH₵${offer.toLocaleString()} (${pct}% off)`;
  sendMsg();
}

// ── CORE: Send a message to the AI
async function sendMsg() {
  if (isLoading) return;

  const input = document.getElementById('chat-input');
  const raw   = input.value.trim();
  if (!raw) return;

  // Security: block prompt injection
  const msg = sanitizeInput(raw);
  if (!msg) {
    addMessage('ai', "Let's keep the conversation focused on the product price.");
    input.value = '';
    return;
  }

  input.value = '';
  addMessage('user', msg);

  // Track session data for learning
  sessionRounds++;
  const priceInMsg = extractPrice(msg);
  if (priceInMsg) {
    if (!sessionFirstOffer) sessionFirstOffer = priceInMsg;  // record very first offer
    sessionLastPrice = priceInMsg;
  }

  isLoading = true;
  document.getElementById('send-btn').disabled = true;

  // Typing indicator
  const area = document.getElementById('chat-area');
  const td   = document.createElement('div');
  td.className = 'msg ai'; td.id = 'typing-ind';
  td.innerHTML =
    `<div class="msg-label">AI Agent</div>
     <div class="msg-bubble">
       <div class="typing"><span></span><span></span><span></span></div>
     </div>`;
  area.appendChild(td);
  area.scrollTop = area.scrollHeight;

  // Build conversation history
  const msgs = chatHistory.slice(0, -1).map(m => ({
    role:    m.role === 'ai' ? 'assistant' : 'user',
    content: m.text.replace(/<[^>]*>/g, '').replace(/DEAL_ACCEPTED:\d+(\.\d+)?/, '')
  }));
  msgs.push({ role: 'user', content: msg });

  try {
    // Call our Python backend — it builds the learned system prompt and calls Claude
    const res = await fetch(`${API_BASE}/negotiate/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        product_id: currentProduct.id,
        messages:   msgs,
        region:     sessionRegion    // passed so backend can use it in live context too
      })
    });

    const data = await res.json();
    document.getElementById('typing-ind')?.remove();

    if (data.error) {
      addMessage('ai', 'Something went wrong: ' + data.error);
    } else {
      addMessage('ai', data.reply || 'Sorry, please try again!');

      // Track the last price the AI mentioned
      const aiPrice = extractPrice(data.reply || '');
      if (aiPrice) sessionLastPrice = aiPrice;
    }

  } catch (e) {
    document.getElementById('typing-ind')?.remove();
    addMessage('ai', 'Connection error: ' + e.message);
  }

  isLoading = false;
  const btn = document.getElementById('send-btn');
  if (btn) btn.disabled = false;
  document.getElementById('chat-input')?.focus();
}

// ── Show the green deal banner when AI agrees a price
function showDealBanner(price) {
  const b = document.getElementById('deal-banner');
  if (!b) return;
  b.innerHTML =
    `<div class="deal-banner">
      <div>
        <div style="font-size:12px;color:var(--green);margin-bottom:2px">Deal Agreed!</div>
        <div class="deal-price">Final Price: ${GHS(price)}</div>
      </div>
      <button class="deal-accept" onclick="acceptDeal(${price})">Add to Cart</button>
    </div>`;
}

// ── Accept deal — record WIN outcome and add to cart
function acceptDeal(price) {
  sessionDealClosed = true;
  recordOutcome(true, price);   // tell the backend a deal was made
  addToCart(currentProduct.id, price, 'negotiated');
  closeModal();
}