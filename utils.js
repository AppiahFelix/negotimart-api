/* ───────────────────────────────────────────
   NegotiMart — Utility Functions
   ─────────────────────────────────────────── */

// Format a number as Ghana Cedis
const GHS = n => `GH₵${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Generate a unique order reference
const genRef = () => 'NM-' + Date.now().toString(36).toUpperCase().slice(-6);

// Show a toast notification
function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = '✓ ' + msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// Map product name keywords to stock images
function getProductImage(name) {
  if (!name) return null;
  const n = name.toLowerCase();
  const map = {
    "rice cooker":      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
    "smartphone":       "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&q=80",
    "laptop":           "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=400&q=80",
    "tablet":           "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400&q=80",
    "smartwatch":       "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80",
    "headphones":       "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
    "speaker":          "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&q=80",
    "camera":           "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400&q=80",
    "monitor":          "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400&q=80",
    "keyboard":         "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&q=80",
    "mouse":            "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&q=80",
    "charger":          "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=400&q=80",
    "power bank":       "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&q=80",
    "t-shirt":          "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80",
    "jeans":            "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&q=80",
    "dress":            "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&q=80",
    "jacket":           "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80",
    "sneakers":         "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    "boots":            "https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=400&q=80",
    "hat":              "https://images.unsplash.com/photo-1533055640609-24b498dfd74c?w=400&q=80",
    "hoodie":           "https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400&q=80",
    "sofa":             "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80",
    "dining table":     "https://images.unsplash.com/photo-1617806118233-18e1de247200?w=400&q=80",
    "bed frame":        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=400&q=80",
    "bookshelf":        "https://images.unsplash.com/photo-1594620302200-9a762244a156?w=400&q=80",
    "lamp":             "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&q=80",
    "rug":              "https://images.unsplash.com/photo-1600166898405-da9535204843?w=400&q=80",
    "running shoes":    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&q=80",
    "yoga mat":         "https://images.unsplash.com/photo-1601925228060-0b17ee3fe8c9?w=400&q=80",
    "dumbbell":         "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80",
    "bicycle":          "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400&q=80",
    "football":         "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=400&q=80",
    "basketball":       "https://images.unsplash.com/photo-1546519638405-a9f2f2e84b38?w=400&q=80",
    "perfume":          "https://images.unsplash.com/photo-1541643600914-78b084683702?w=400&q=80",
    "lipstick":         "https://images.unsplash.com/photo-1586495777744-4e6232bf2f9c?w=400&q=80",
    "moisturizer":      "https://images.unsplash.com/photo-1611080626919-7cf5a9dbab12?w=400&q=80",
    "hair dryer":       "https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=400&q=80",
    "novel":            "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80",
    "textbook":         "https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400&q=80",
    "cookbook":         "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&q=80",
    "blender":          "https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=400&q=80",
    "coffee maker":     "https://images.unsplash.com/photo-1520970014086-2208d157c9e2?w=400&q=80",
    "toaster":          "https://images.unsplash.com/photo-1621193793262-4127d9855c91?w=400&q=80",
    "air fryer":        "https://images.unsplash.com/photo-1626137984891-f1f5ad51f6a5?w=400&q=80",
    "knife set":        "https://images.unsplash.com/photo-1593618998160-e34014e67546?w=400&q=80",
    "cookware":         "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80",
    "electric kettle":  "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=400&q=80",
    "action figure":    "https://images.unsplash.com/photo-1608889175123-8ee362201f81?w=400&q=80",
    "board game":       "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?w=400&q=80",
    "puzzle":           "https://images.unsplash.com/photo-1605296867424-35fc25c9212a?w=400&q=80",
    "lego":             "https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400&q=80",
    "doll":             "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&q=80",
  };
  for (const [key, url] of Object.entries(map)) {
    if (n.includes(key)) return url;
  }
  return "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80";
}

// Sanitize user input to block prompt injection attacks
function sanitizeInput(msg) {
  const dangerous = [
    'ignore', 'forget', 'override', 'system prompt',
    'instructions', 'pretend', 'jailbreak',
    'give me for free', 'no cost', 'bypass'
  ];
  const lower = msg.toLowerCase();
  for (const word of dangerous) {
    if (lower.includes(word)) return null;
  }
  return msg;
}
