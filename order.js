// ================================
// Prime Follower - Order Page Module
// Order flow, progress bar, countdown timer
// ================================

// ── 1. Imports ────────────────────────────────────────────────────────────────

import { auth, getUserProfile, createOrder, getActiveOrders } from "./firebase.js";

// ── 2. Utility Functions ──────────────────────────────────────────────────────

/** Bumps the floating credits display with a brief CSS animation. */
function updateCreditsDisplay(credits) {
  const el = document.getElementById("credit-count");
  const container = document.getElementById("floating-credits");
  if (!el || !container) return;
  el.textContent = credits;
  container.classList.add("credit-bump");
  setTimeout(() => container.classList.remove("credit-bump"), 500);
}

// ── 3. State ──────────────────────────────────────────────────────────────────

/** Holds the currently selected order until confirmed or cancelled. */
let selectedOrder = null;

/** Reference to the active countdown interval so it can be cleared. */
let countdownInterval = null;

// ── 4. First Free Order Logic ─────────────────────────────────────────────────

const firstFreeCard = document.getElementById("first-free-card");
const firstOrderBtn = document.getElementById("first-order-btn");
const firstCostText = document.getElementById("first-cost-text");

/**
 * Shows or hides the "first order free" card based on the user's order history.
 * Safe to call multiple times — always reflects current state.
 */
function updateFirstOrderUI() {
  const user = window.cashTreasureUser;
  if (!user || !firstFreeCard) return;

  const hasUsedFree = (user.total_followers_ordered || 0) > 0;

  if (hasUsedFree) {
    firstFreeCard.style.display = "none";
  } else {
    firstFreeCard.style.display = "flex";
    if (firstOrderBtn) {
      firstOrderBtn.textContent = "FREE";
      firstOrderBtn.style.background = "#22c55e";
      firstOrderBtn.style.color = "white";
      firstOrderBtn.style.border = "none";
    }
    if (firstCostText) {
      firstCostText.innerHTML = `Cost: <span style="text-decoration:line-through;color:#999;">5 Credits</span>`;
    }
  }
}

/** Resets the first-order button back to its default (non-free) visual state. */
function resetFirstOrderBtn() {
  if (!firstOrderBtn || !firstCostText) return;
  firstOrderBtn.textContent = "ORDER";
  firstOrderBtn.style.background = "";
  firstOrderBtn.style.color = "";
  firstOrderBtn.style.border = "";
  firstCostText.innerHTML = "Cost: 5 Credits";
}

// Run as soon as user data is available
window.addEventListener("userReady", updateFirstOrderUI);
if (window.cashTreasureUser) updateFirstOrderUI();

firstOrderBtn?.addEventListener("click", () => {
  const user = window.cashTreasureUser;
  if (!user) return window.showToast?.("Please login first.", "error");
  if ((user.total_followers_ordered || 0) > 0) {
    return window.showToast?.("Free order already used!", "error");
  }
  selectedOrder = { followers: 3, credits_spent: 0, isFirstOrderFree: true };
  document.getElementById("rules-modal").classList.add("visible");
});

// ── 5. Order Selection & Rules Modal ─────────────────────────────────────────

// Rules checkbox — gate the NEXT button until the user ticks it
const rulesCheckbox = document.getElementById("rules-agree");
const rulesNextBtn = document.getElementById("rules-agree-btn");

if (rulesCheckbox && rulesNextBtn) {
  rulesNextBtn.disabled = true;
  rulesNextBtn.style.opacity = "0.6";

  rulesCheckbox.addEventListener("change", () => {
    const checked = rulesCheckbox.checked;
    rulesNextBtn.disabled = !checked;
    rulesNextBtn.style.opacity = checked ? "1" : "0.6";
  });
}

// All standard order cards (skip first-free, premium buy, diamond, and level-locked)
document.querySelectorAll(".order-card .btn-order").forEach(btn => {
  if (btn.id === "first-order-btn" || btn.id === "btn-open-buy") return;
  if (btn.classList.contains("btn-diamond-order")) return;       // handled separately
  if (btn.classList.contains("btn-level-credit-order")) return;  // handled separately

  btn.addEventListener("click", (e) => {
    const card = e.target.closest(".order-card");
    const followers = parseInt(card.dataset.followers);
    const cost = parseInt(card.dataset.cost);
    const user = window.cashTreasureUser;

    if (!user) return window.showToast?.("Please login first.", "error");

    // Only block if user has less than 70% of the cost
    const threshold = Math.floor(cost * 0.7);
    if (user.credits < threshold) return window.showToast?.("❌ Not enough credits!", "error");

    selectedOrder = { followers, credits_spent: cost, isFirstOrderFree: false };
    document.getElementById("rules-modal").classList.add("visible");
  });
});

// Rules → advance to Instagram details modal
rulesNextBtn?.addEventListener("click", () => {
  document.getElementById("rules-modal").classList.remove("visible");
  const igUsernameInput = document.getElementById("order-ig-username");
  const igLinkInput = document.getElementById("order-ig-link");
  igUsernameInput.value = "";
  igLinkInput.value = "";

  // Auto-fill from connected Instagram
  if (typeof window.autoFillInstagram === 'function') {
    window.autoFillInstagram(igUsernameInput, igLinkInput);
  }

  document.getElementById("username-modal").classList.add("visible");
});

// Backdrop dismissal for both modals
document.getElementById("rules-modal")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove("visible");
    selectedOrder = null;
  }
});

document.getElementById("username-modal")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove("visible");
    selectedOrder = null;
  }
});

// Cancel from the Instagram details modal
document.getElementById("cancel-order-btn")?.addEventListener("click", () => {
  document.getElementById("username-modal").classList.remove("visible");
  selectedOrder = null;
});

// ── 6. Instagram Details Modal & Validation ───────────────────────────────────

/** Validates the Instagram username and optional link fields. Returns an error string or null. */
function validateIGFields(username, link) {
  if (!username) return "Please enter your Instagram username.";
  if (link && !link.startsWith("https://www.instagram.com")) {
    return "Instagram link must start with https://www.instagram.com";
  }
  return null;
}

// ── 7. Order Creation & Processing ───────────────────────────────────────────

/** Sends an order confirmation email via EmailJS (fire-and-forget — never blocks UX). */
async function sendOrderEmail(user, igUsername, igLink, order) {
  if (typeof emailjs === "undefined") return;
  try {
    await emailjs.send("service_swt79ip", "template_urw0ymr", {
      user_email: user.email,
      insta_username: igUsername,
      insta_link: igLink || "Not provided",
      credits: order.isFirstOrderFree ? "FREE (First Order)" : order.credits_spent,
      time_left: "Within 24 hours delivery",
      order_time: new Date().toLocaleString(),
      is_first_order: order.isFirstOrderFree ? "Yes - First Order Free" : "No"
    });
  } catch (err) {
    console.warn("[Order] Email failed:", err);
  }
}

/** Appends a single transaction entry to the transaction list on the order page. */
function appendTransactionEntry(creditsSpent) {
  const list = document.getElementById("transaction-list");
  if (!list || creditsSpent == null) return;
  list.innerHTML = `
    <div class="transaction-item">
      <div class="tx-info">
        <div class="tx-action">Followers Order</div>
        <div class="tx-date">${new Date().toLocaleString()}</div>
      </div>
      <div class="tx-amount negative">-${creditsSpent}</div>
    </div>`;
}

document.getElementById("confirm-order-btn")?.addEventListener("click", async () => {
  const user = window.cashTreasureUser;

  if (!user || !selectedOrder || typeof selectedOrder.credits_spent === "undefined") {
    return window.showToast?.("Please select an order first.", "error");
  }

  const igUsername = document.getElementById("order-ig-username").value.trim();
  const igLink = document.getElementById("order-ig-link").value.trim();
  const validationError = validateIGFields(igUsername, igLink);

  if (validationError) return window.showToast?.(validationError, "error");

  // Apply credit coupon discount if present
  let finalCost = selectedOrder.credits_spent;
  const creditCouponData = window._appliedCreditCoupon;
  if (creditCouponData && creditCouponData.valid) {
    finalCost = creditCouponData.finalPrice;
  }

  if (user.credits < finalCost) {
    return window.showToast?.("You don't have enough credits!", "error");
  }

  // Override cost with discounted amount
  selectedOrder.credits_spent = finalCost;

  const btn = document.getElementById("confirm-order-btn");
  btn.disabled = true;
  btn.textContent = "⏳ Processing...";


    // Handle Diamond Orders — fully server-controlled
// Handle Diamond Orders — fully server-controlled
if (selectedOrder.isDiamondOrder) {
  try {
    const resp = await fetch('https://payment-backend-production-0b8d.up.railway.app/diamond-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.uid,
        followers: selectedOrder.followers,
        diamondCost: selectedOrder.diamondCost,
        instagram_username: igUsername,
        instagram_link: igLink
      })
    });
    const dRes = await resp.json();

    if (!dRes.success) {
      btn.disabled = false;
      btn.textContent = "CONFIRM ORDER";
      return window.showToast?.(dRes.message || "Diamond order failed", "error");
    }

    window.showToast?.(`✅ Order placed! ${selectedOrder.followers} followers incoming!`);
    sendOrderEmail(user, igUsername, igLink, { ...selectedOrder, isFirstOrderFree: false });
    document.getElementById("username-modal").classList.remove("visible");

    if (dRes.completionTime) startCountdown(new Date(dRes.completionTime));

    // Update diamond count
    const diamondEl = document.getElementById("diamond-count");
    if (diamondEl && dRes.newDiamonds !== undefined) diamondEl.textContent = dRes.newDiamonds;

    btn.disabled = false;
    btn.textContent = "CONFIRM ORDER";
    selectedOrder = null;
    return;
  } catch (dErr) {
    console.error("Diamond order error:", dErr);
    btn.disabled = false;
    btn.textContent = "CONFIRM ORDER";
    return window.showToast?.("Network error. Try again.", "error");
  }
}

  const orderSnapshot = { ...selectedOrder };

  try {
    const resp = await fetch('https://payment-backend-production-0b8d.up.railway.app/create-credit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.uid,
        followers: selectedOrder.followers,
        baseCost: selectedOrder.credits_spent,
        instagram_username: igUsername,
        instagram_link: igLink,
        couponId: (creditCouponData && creditCouponData.couponId) ? creditCouponData.couponId : null,
        isFirstFree: selectedOrder.isFirstOrderFree === true
      })
    });
    const result = await resp.json();

    if (!result.success) {
      window.showToast?.(result.message || "Order failed", "error");
      return;
    }

    window.showToast?.(`✅ Order placed! ${orderSnapshot.followers} followers incoming!`);
    resetCreditCoupon();

    // Non-blocking email notification
    sendOrderEmail(user, igUsername, igLink, orderSnapshot);

    document.getElementById("username-modal").classList.remove("visible");

    // Sync credits from server
    const profile = await getUserProfile(user.uid);
    if (profile) {
      updateCreditsDisplay(profile.credits);
      window.cashTreasureUser.credits = profile.credits;
      window.cashTreasureUser.total_followers_ordered = profile.total_followers_ordered || 0;
    }

    updateFirstOrderUI();
    appendTransactionEntry(result.finalCost);

    if (result.completionTime) {
      startCountdown(new Date(result.completionTime));
    }

  } catch (err) {
    console.error("[Order] Confirm error:", err);
    window.showToast?.("Error — please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "CONFIRM ORDER";
    resetFirstOrderBtn();
    updateFirstOrderUI();
    selectedOrder = null;
  }
});

// ── 8. Active Orders & Countdown System ──────────────────────────────────────

/** Fetches any in-progress orders and starts the countdown, or shows celebration if done. */
async function checkActiveOrders(uid) {
  try {
    const orders = await getActiveOrders(uid);
    if (orders.length === 0) return;

    const latest = orders[0];
    const seenKey = `celebration_seen_${latest.id}`;
    const completionTime = latest.completion_time?.toDate
      ? latest.completion_time.toDate()
      : new Date(latest.completion_time);

    if (completionTime > new Date()) {
      startCountdown(completionTime);
    } else if (!localStorage.getItem(seenKey)) {
      showCelebration();
      localStorage.setItem(seenKey, "true");
    }
  } catch (err) {
    console.error("[Order] Active orders error:", err);
  }
}

/**
 * Starts a live countdown against a target completion time.
 * Updates the progress bar and timer every second.
 */
function startCountdown(completionTime) {
  const progressSection = document.getElementById("order-progress");
  const timerEl = document.getElementById("countdown-timer");
  const barFill = document.getElementById("progress-bar-fill");
  if (!progressSection || !timerEl || !barFill) return;

  progressSection.classList.add("visible");

  const endTime = completionTime instanceof Date ? completionTime : new Date(completionTime);
  const TOTAL_DURATION = 24 * 60 * 60 * 1000; // 24 hours in ms

  if (countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    const remaining = endTime.getTime() - Date.now();

    if (remaining <= 0) {
      clearInterval(countdownInterval);
      timerEl.textContent = "00:00:00";
      barFill.style.width = "100%";
      setTimeout(showCelebration, 500);
      return;
    }

    const h = Math.floor(remaining / 3_600_000);
    const m = Math.floor((remaining % 3_600_000) / 60_000);
    const s = Math.floor((remaining % 60_000) / 1_000);

    timerEl.textContent =
      String(h).padStart(2, "0") + ":" +
      String(m).padStart(2, "0") + ":" +
      String(s).padStart(2, "0");

    const elapsed = TOTAL_DURATION - remaining;
    barFill.style.width = `${Math.min((elapsed / TOTAL_DURATION) * 100, 100)}%`;
  }, 1000);
}

// ── 9. Celebration Popup ──────────────────────────────────────────────────────

function showCelebration() {
  document.getElementById("celebration-overlay")?.classList.add("visible");
  document.getElementById("order-progress")?.classList.remove("visible");
  if (countdownInterval) clearInterval(countdownInterval);
}

document.getElementById("celebration-close")?.addEventListener("click", () => {
  document.getElementById("celebration-overlay").classList.remove("visible");
});

// ── 10. Order Progress Click → Show Details ───────────────────────────────────

document.getElementById("order-progress")?.addEventListener("click", async () => {
  const user = window.cashTreasureUser;
  if (!user) return;

  try {
    const orders = await getActiveOrders(user.uid);
    if (orders.length === 0) return;

    const latest = orders[0];
    const orderDate = latest.order_time?.toDate ? latest.order_time.toDate() : new Date();
    const isPaid = latest.isPaidOrder === true;
    const diffHours = (Date.now() - orderDate.getTime()) / (1000 * 60 * 60);

    const costLine = document.getElementById('detail-cost-line');
    const statusEl = document.getElementById('detail-status');

    if (isPaid && costLine) {
      costLine.innerHTML = `Cost: <span style="font-weight:800;">₹${latest.paidAmount || 0}</span>`;
    } else if (costLine) {
      costLine.innerHTML = `Credits Used: <span>${latest.credits_spent || 0}</span> <img src="icons/cashbag.png" style="height:18px;">`;
    }

    document.getElementById('detail-followers').textContent = latest.followers || 0;
    document.getElementById('detail-date').textContent = orderDate.toLocaleDateString();
    document.getElementById('detail-time').textContent = orderDate.toLocaleTimeString();

    if (statusEl) {
      if (isPaid) {
        if (diffHours < 1) {
          statusEl.textContent = "Pending";
          statusEl.style.color = "red";
        } else if (diffHours < 4) {
          statusEl.textContent = "Processing";
          statusEl.style.color = "orange";
        } else if (diffHours < 24) {
          statusEl.textContent = "Working";
          statusEl.style.color = "#d4a017";
        } else {
          statusEl.textContent = "Delivered Successfully";
          statusEl.style.color = "green";
        }
      } else {
        if (diffHours < 1) {
          statusEl.textContent = "Pending";
          statusEl.style.color = "red";
        } else if (diffHours < 24) {
          statusEl.textContent = "Working";
          statusEl.style.color = "orange";
        } else {
          statusEl.textContent = "Delivered Successfully";
          statusEl.style.color = "green";
        }
      }
    }

    document.getElementById('order-detail-modal')?.classList.add('visible');
  } catch (err) {
    console.error("[Order] Progress click error:", err);
  }
});

// ── 11. Initialization ────────────────────────────────────────────────────────

window.addEventListener("userReady", async (e) => {
  await checkActiveOrders(e.detail.uid);
});

// Global helper for external callers (kept for backward compatibility)
window.sendOrderEmail = function (data) {
  if (typeof emailjs === "undefined") return;
  emailjs.send("service_swt79ip", "template_urw0ymr", {
    user_email: data.email,
    insta_username: data.username,
    insta_link: data.link,
    credits: data.credits,
    time_left: data.time,
    order_time: new Date().toLocaleString()
  })
    .then(() => console.log("[Order] Email sent"))
    .catch(err => console.error("[Order] Email error:", err));
};



// Make startCountdown available to pay.js
window.startCountdown = startCountdown;





// ══════════════════════════════════════════════════
// COUPON SYSTEM — Credit Orders
// ══════════════════════════════════════════════════

const RAILWAY_URL = 'https://payment-backend-production-0b8d.up.railway.app';
window._appliedCreditCoupon = null;

function resetCreditCoupon() {
  window._appliedCreditCoupon = null;
  const input = document.getElementById('credit-coupon-input');
  const btn = document.getElementById('credit-coupon-apply');
  const status = document.getElementById('credit-coupon-status');

  if (input) { input.value = ''; input.disabled = false; }
  if (btn) {
    btn.textContent = 'APPLY';
    btn.className = 'coupon-apply-btn';
    btn.disabled = false;
  }
  if (status) { status.textContent = ''; status.className = 'coupon-status'; }

  // Remove discount display if present
  document.getElementById('credit-coupon-display')?.remove();
}

async function validateCreditCoupon() {
  const input = document.getElementById('credit-coupon-input');
  const btn = document.getElementById('credit-coupon-apply');
  const status = document.getElementById('credit-coupon-status');

  if (!input || !btn || !status) return;

  // If already applied, remove it
  if (window._appliedCreditCoupon) {
    resetCreditCoupon();
    return;
  }

  const code = input.value.trim().toUpperCase();
  if (!code) {
    status.textContent = '❌ Please enter a coupon code';
    status.className = 'coupon-status error';
    return;
  }

  if (!selectedOrder) {
    status.textContent = '❌ No order selected';
    status.className = 'coupon-status error';
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳';
  status.textContent = 'Validating...';
  status.className = 'coupon-status loading';

  try {
    const res = await fetch(`${RAILWAY_URL}/validate-coupon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        orderType: 'credits',
        amount: selectedOrder.credits_spent,
        userId: window.cashTreasureUser?.uid || ""
      })
    });

    const data = await res.json();

    if (data.valid) {
      window._appliedCreditCoupon = data;
      input.disabled = true;
      btn.textContent = '✕ REMOVE';
      btn.className = 'coupon-apply-btn remove';
      btn.disabled = false;
      status.textContent = `✅ ${data.message}`;
      status.className = 'coupon-status success';

      // Show discount info
      const confirmBtn = document.getElementById('confirm-order-btn');
      if (confirmBtn) {
        const display = document.createElement('div');
        display.id = 'credit-coupon-display';
        display.className = 'coupon-credit-display';
        display.innerHTML = `Original: <s>${selectedOrder.credits_spent} Credits</s> → <b>${data.finalPrice} Credits</b> (${data.discount}% OFF)`;
        confirmBtn.parentNode.insertBefore(display, confirmBtn);
      }
    } else {
      btn.textContent = 'APPLY';
      btn.disabled = false;
      status.textContent = `❌ ${data.message}`;
      status.className = 'coupon-status error';
    }
  } catch (err) {
    console.error('Credit coupon validation error:', err);
    btn.textContent = 'APPLY';
    btn.disabled = false;
    status.textContent = '❌ Network error. Try again.';
    status.className = 'coupon-status error';
  }
}

// Wire credit coupon apply button
document.getElementById('credit-coupon-apply')?.addEventListener('click', validateCreditCoupon);

document.getElementById('credit-coupon-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    validateCreditCoupon();
  }
});

// Reset coupon when modal closes
document.getElementById("cancel-order-btn")?.addEventListener("click", () => {
  resetCreditCoupon();
});

// Also reset when username modal is opened fresh (from rules → username flow)
const origRulesNextBtn = document.getElementById("rules-agree-btn");
if (origRulesNextBtn) {
  origRulesNextBtn.addEventListener("click", () => {
    resetCreditCoupon();
  });
}



// ══════════════════════════════════════════════════
// DIAMOND ORDER SYSTEM
// ══════════════════════════════════════════════════

document.querySelectorAll(".btn-diamond-order").forEach(btn => {
  btn.addEventListener("click", async () => {
    const user = window.cashTreasureUser;
    if (!user) return window.showToast?.("Please login first.", "error");

    const diamondCost = parseInt(btn.dataset.diamonds);
    const followers = parseInt(btn.dataset.followers);

    // Check diamond balance (display-only check; server enforces real deduction)
    const { getUserProfile: getProfile } = await import("./firebase.js");
    const profile = await getProfile(user.uid);
    const userDiamonds = profile?.diamonds || 0;

    if (userDiamonds < diamondCost) {
      return window.showToast?.(`You need ${diamondCost} 💎! You have ${userDiamonds}.`, "error");
    }

    // Set up order and ONLY THEN show rules
    selectedOrder = { followers, credits_spent: 0, isDiamondOrder: true, diamondCost };
    document.getElementById("rules-modal").classList.add("visible");
  });
});

// Override confirm to handle diamond orders
const origConfirmHandler = document.getElementById("confirm-order-btn");
if (origConfirmHandler) {
  const origClick = origConfirmHandler.onclick;

  // We'll add diamond deduction logic inside the existing confirm flow
  // by hooking into the selectedOrder.isDiamondOrder flag
}

// ══════════════════════════════════════════════════
// LEVEL-LOCKED CREDIT ORDERS (Level 3+)
// ══════════════════════════════════════════════════

document.querySelectorAll(".btn-level-credit-order").forEach(btn => {
  btn.addEventListener("click", () => {
    const user = window.cashTreasureUser;
    if (!user) return window.showToast?.("Please login first.", "error");

    const minLevel = parseInt(btn.dataset.minLevel) || 3;

    // Check user level from profile
    const checkLevel = async () => {
      const { getUserProfile: getProfile } = await import("./firebase.js");
      const profile = await getProfile(user.uid);
      const userLevel = profile?.level || 1;

      if (userLevel < minLevel) {
        return window.showToast?.("Only for users above Prime-Shark", "error");
      }

      const card = btn.closest(".order-card");
      const followers = parseInt(card.dataset.followers);
      const cost = parseInt(card.dataset.cost);

      const threshold = Math.floor(cost * 0.7);
      if (user.credits < threshold) return window.showToast?.("❌ Not enough credits!", "error");

      selectedOrder = { followers, credits_spent: cost, isFirstOrderFree: false };
      document.getElementById("rules-modal").classList.add("visible");
    };

    checkLevel();
  });
});

console.log("✅ Order module loaded.");