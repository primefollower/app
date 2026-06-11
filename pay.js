// ================================
// Pay Module - Cashfree Integration + Coupon System
// ================================

// ── 1. Imports ──
import {
  db,
  serverTimestamp,
  Timestamp,
  getUserProfile,
  updateDoc,
  doc,
  createOrder
} from "./firebase.js";

import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── 2. Configuration ──
const RAILWAY_URL = 'https://payment-backend-production-0b8d.up.railway.app';
let currentTimer = null;
let currentPackageData = null;
let appliedPaidCoupon = null; // Stores validated coupon for paid orders

// Init EmailJS
if (typeof emailjs !== 'undefined') {
  emailjs.init("q7jXY0z5Uwry4IiZs");
}

// ── 3. Toast ──
export function showToast(message, type = 'success') {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

// ── 4. Check cooldown ──
async function canPlacePaidOrder(uid) {
  const q = query(
    collection(db, "paid_orders"),
    where("user_id", "==", uid),
    where("status", "==", "paid")
  );
  const snap = await getDocs(q);
  if (snap.empty) return true;
  const lastPaid = snap.docs[0].data().paid_at?.toDate?.() ?? new Date();
  const hoursSince = (Date.now() - lastPaid.getTime()) / (1000 * 60 * 60);
  return hoursSince >= 12;
}

// ── 5. Modal Handlers ──
window.closePaymentModal = function () {
  ['payment-success-modal', 'payment-cancel-modal', 'payment-confirm-modal']
    .forEach(id => document.getElementById(id)?.classList.remove('visible'));
};

window.cancelPaymentConfirm = function () {
  document.getElementById('payment-confirm-modal')?.classList.remove('visible');
};

window.proceedToCashfree = function () {
  document.getElementById('payment-confirm-modal')?.classList.remove('visible');
  document.getElementById('instagram-details-modal')?.classList.add('visible');

  // Autofill from connected Instagram
  const uInput = document.getElementById('paid-ig-username');
  const lInput = document.getElementById('paid-ig-link');
  if (uInput) uInput.value = '';
  if (lInput) lInput.value = '';
  if (typeof window.autoFillInstagram === 'function') {
    window.autoFillInstagram(uInput, lInput);
  }
};

window.closeInstagramModal = function () {
  document.getElementById('instagram-details-modal')?.classList.remove('visible');
  resetPaidCoupon();
};

document.getElementById('how-link')?.addEventListener('click', () => {
  if (typeof window.openImagePopup === 'function') {
    window.openImagePopup('drop.jpg');
  }
});

// ══════════════════════════════════════════════════
// COUPON SYSTEM — Paid Orders
// ══════════════════════════════════════════════════

function resetPaidCoupon() {
  appliedPaidCoupon = null;
  const input = document.getElementById('paid-coupon-input');
  const btn = document.getElementById('paid-coupon-apply');
  const status = document.getElementById('paid-coupon-status');
  const priceDisplay = document.getElementById('paid-price-display');

  if (input) { input.value = ''; input.disabled = false; }
  if (btn) {
    btn.textContent = 'APPLY';
    btn.className = 'coupon-apply-btn';
    btn.disabled = false;
  }
  if (status) { status.textContent = ''; status.className = 'coupon-status'; }
  if (priceDisplay) priceDisplay.style.display = 'none';
}

async function validatePaidCoupon() {
  const input = document.getElementById('paid-coupon-input');
  const btn = document.getElementById('paid-coupon-apply');
  const status = document.getElementById('paid-coupon-status');

  if (!input || !btn || !status) return;

  // If already applied, clicking removes it
  if (appliedPaidCoupon) {
    resetPaidCoupon();
    return;
  }

  const code = input.value.trim().toUpperCase();
  if (!code) {
    status.textContent = '❌ Please enter a coupon code';
    status.className = 'coupon-status error';
    return;
  }

  if (!currentPackageData) {
    status.textContent = '❌ No package selected';
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
        orderType: 'paidOrders',
        amount: currentPackageData.amount,
        userId: window.cashTreasureUser?.uid || ""
      })
    });

    const data = await res.json();

    if (data.valid) {
      appliedPaidCoupon = data;
      input.disabled = true;
      btn.textContent = '✕ REMOVE';
      btn.className = 'coupon-apply-btn remove';
      btn.disabled = false;
      status.textContent = `✅ ${data.message}`;
      status.className = 'coupon-status success';

      // Show price breakdown
      const priceDisplay = document.getElementById('paid-price-display');
      const originalEl = document.getElementById('paid-price-original');
      const finalEl = document.getElementById('paid-price-final');
      if (priceDisplay && originalEl && finalEl) {
        originalEl.textContent = `Original: ₹${currentPackageData.amount}`;
        finalEl.textContent = `Pay: ₹${data.finalPrice}`;
        priceDisplay.style.display = 'block';
      }
    } else {
      btn.textContent = 'APPLY';
      btn.disabled = false;
      status.textContent = `❌ ${data.message}`;
      status.className = 'coupon-status error';
    }
  } catch (err) {
    console.error('Coupon validation error:', err);
    btn.textContent = 'APPLY';
    btn.disabled = false;
    status.textContent = '❌ Network error. Try again.';
    status.className = 'coupon-status error';
  }
}

// Wire paid coupon apply button
document.getElementById('paid-coupon-apply')?.addEventListener('click', validatePaidCoupon);

// Also allow Enter key in coupon input
document.getElementById('paid-coupon-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    validatePaidCoupon();
  }
});

// ══════════════════════════════════════════════════
// PAID ORDER RULES MODAL
// ══════════════════════════════════════════════════

const paidRulesCheckbox = document.getElementById('paid-rules-agree');
const paidRulesConfirmBtn = document.getElementById('paid-rules-confirm-btn');
const paidRulesCancelBtn = document.getElementById('paid-rules-cancel-btn');

function resetPaidRulesModal() {
  if (paidRulesCheckbox) paidRulesCheckbox.checked = false;
  if (paidRulesConfirmBtn) {
    paidRulesConfirmBtn.disabled = true;
    paidRulesConfirmBtn.classList.remove('active');
  }
}

if (paidRulesCheckbox && paidRulesConfirmBtn) {
  paidRulesCheckbox.addEventListener('change', () => {
    const checked = paidRulesCheckbox.checked;
    paidRulesConfirmBtn.disabled = !checked;
    if (checked) {
      paidRulesConfirmBtn.classList.add('active');
    } else {
      paidRulesConfirmBtn.classList.remove('active');
    }
  });
}

paidRulesCancelBtn?.addEventListener('click', () => {
  document.getElementById('paid-rules-modal')?.classList.remove('visible');
  resetPaidRulesModal();
  currentPackageData = null;
});

paidRulesConfirmBtn?.addEventListener('click', () => {
  if (paidRulesConfirmBtn.disabled) return;
  document.getElementById('paid-rules-modal')?.classList.remove('visible');
  resetPaidRulesModal();

  // Show PAY TO PRIME FOLLOWER confirmation
  const confirmText = document.getElementById('confirm-text');
  if (confirmText) {
    const amount = appliedPaidCoupon ? appliedPaidCoupon.finalPrice : currentPackageData.amount;
    confirmText.innerHTML = `
      <b>YOU ARE GOING TO PAY ₹${amount} FOR ${currentPackageData.followers} FOLLOWERS</b><br><br>
      ${appliedPaidCoupon ? `<span style="color:#16a34a;">🎟️ Coupon Applied: ${appliedPaidCoupon.discount}% OFF</span><br><br>` : ''}
      <b>ARE YOU SURE YOU WANT TO PROCEED?</b>`;
  }
  document.getElementById('payment-confirm-modal')?.classList.add('visible');
});

// ── 6. Payment Success Handler ──
async function handlePaymentSuccess(orderId, packageData) {
  if (!orderId) { console.error("handlePaymentSuccess: no orderId"); return; }
  if (localStorage.getItem(`paid_${orderId}`)) {
    console.log("Already processed:", orderId); return;
  }

  const user = window.cashTreasureUser;
  if (!user) { console.error("handlePaymentSuccess: no user"); return; }

  try {
    console.log("🎯 Processing payment success:", orderId, packageData);

    const orderResult = await createOrder(user.uid, {
      instagram_username: packageData.instagram_username || "Paid_Order",
      instagram_link:     packageData.instagram_link     || "",
      followers:          packageData.followers,
      credits_spent:      0,
      isPaidOrder:        true,
      paidAmount:         packageData.finalAmount || packageData.amount
    });

    console.log("📦 Order creation result:", orderResult);

    if (!orderResult.success) {
      console.error("❌ Order creation failed:", orderResult.message);
      showToast("Order creation failed: " + orderResult.message, "error");
      return;
    }

    // Save to paid_orders for cooldown
    try {
      const { addDoc, collection: col, serverTimestamp: st } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      await addDoc(col(db, "paid_orders"), {
        user_id: user.uid,
        order_id: orderId,
        followers: packageData.followers,
        amount: packageData.finalAmount || packageData.amount,
        originalAmount: packageData.amount,
        couponCode: packageData.couponCode || null,
        couponDiscount: packageData.couponDiscount || 0,
        instagram_username: packageData.instagram_username || "",
        instagram_link: packageData.instagram_link || "",
        status: "paid",
        paid_at: st()
      });
    } catch (paidOrderErr) {
      console.warn("paid_orders write failed (non-critical):", paidOrderErr);
    }

    // Redeem coupon if one was applied
    if (packageData.couponId) {
      try {
        await fetch(`${RAILWAY_URL}/redeem-coupon`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            couponId: packageData.couponId,
            userId: user.uid,
            orderId: orderId
          })
        });
        console.log("🎟️ Coupon redeemed");
      } catch (couponErr) {
        console.warn("Coupon redeem failed (non-critical):", couponErr);
      }
    }

    localStorage.setItem(`paid_${orderId}`, "1");

    // Show success modal
    const detailsEl = document.getElementById('success-details');
    if (detailsEl) {
      const displayAmount = packageData.finalAmount || packageData.amount;
      detailsEl.innerHTML = `
        THE ORDER OF <b>${packageData.followers}</b> FOLLOWERS FOR <b>₹${displayAmount}</b><br><br>
        ${packageData.couponCode ? `COUPON <b>${packageData.couponCode}</b> APPLIED (${packageData.couponDiscount}% OFF)<br><br>` : ''}
        IS SUCCESSFULLY PLACED<br><br>
        PAYMENT RECEIVED SUCCESSFULLY<br><br>
        WE WILL DELIVER WITHIN 24 HOURS
      `;
    }
    document.getElementById('payment-success-modal')?.classList.add('visible');

    // Start countdown timer
    if (orderResult.completionTime) {
      const progressSection = document.getElementById("order-progress");
      if (progressSection) {
        progressSection.style.display = "block";
        progressSection.classList.add("visible");
      }
      if (typeof window.startCountdown === 'function') {
        window.startCountdown(orderResult.completionTime);
      }
    }

    // Send email (non-blocking)
    if (typeof emailjs !== 'undefined' && !localStorage.getItem(`mail_sent_${orderId}`)) {
      try {
        const displayAmount = packageData.finalAmount || packageData.amount;
        await emailjs.send("service_swt79ip", "template_urw0ymr", {
          user_email:     user.email,
          insta_username: packageData.instagram_username || "Paid Purchase",
          insta_link:     packageData.instagram_link     || "Real Money Order",
          credits:        `₹${displayAmount} - ${packageData.followers} Followers${packageData.couponCode ? ` (Coupon: ${packageData.couponCode})` : ''}`,
          time_left:      "Within 24 hours",
          order_time:     new Date().toLocaleString(),
          is_first_order: "Real Money Payment"
        });
        localStorage.setItem(`mail_sent_${orderId}`, "1");
      } catch (mailErr) {
        console.error("EmailJS failed:", mailErr);
      }
    }

    // Reset coupon state
    resetPaidCoupon();

        // Track elite order monthly limit
    if (packageData.isEliteOrder) {
      window.dispatchEvent(new CustomEvent('eliteOrderComplete'));
    }

    console.log("✅ Payment fully processed:", orderId);

  } catch (err) {
    console.error("❌ handlePaymentSuccess error:", err);
    showToast("Payment recorded but order failed. Contact support with ID: " + orderId, "error");
  }
}

// ── 7. Polling Verification ──
async function startPaymentVerification(orderId, packageData) {
  let attempts = 0;
  console.log("🔄 Starting payment verification polling for:", orderId);

  const interval = setInterval(async () => {
    attempts++;
    if (attempts > 24) {
      clearInterval(interval);
      console.warn("Polling timed out for:", orderId);
      return;
    }

    if (localStorage.getItem(`paid_${orderId}`)) {
      clearInterval(interval);
      return;
    }

    try {
      const res = await fetch(`${RAILWAY_URL}/verify-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      console.log(`Poll attempt ${attempts}:`, data);

      if (data.success) {
        clearInterval(interval);
        await handlePaymentSuccess(orderId, packageData);
      }
    } catch (e) {
      console.warn("Poll error:", e);
    }
  }, 2500);
}

// ── 8. Main Payment Function ──
export async function buyWithCashfree(packageData) {
  const user = window.cashTreasureUser;
  if (!user) return showToast("Please login first", "error");

  const canOrder = await canPlacePaidOrder(user.uid);
  if (!canOrder) return showToast("You can only place one order every 12 hours", "error");

  const btn = document.getElementById('confirm-instagram-btn');
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Processing..."; }

  // Determine final amount (with or without coupon)
  const finalAmount = appliedPaidCoupon ? appliedPaidCoupon.finalPrice : packageData.amount;

  // Attach coupon info to packageData
  if (appliedPaidCoupon) {
    packageData.couponId = appliedPaidCoupon.couponId;
    packageData.couponCode = appliedPaidCoupon.code;
    packageData.couponDiscount = appliedPaidCoupon.discount;
    packageData.finalAmount = finalAmount;
  } else {
    packageData.finalAmount = packageData.amount;
  }

  try {
    const res = await fetch(`${RAILWAY_URL}/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount:    finalAmount,
        userId:    user.uid,
        username:  user.username || "User",
        email:     user.email    || "user@example.com",
        followers: packageData.followers
      })
    });

    const data = await res.json();
    console.log("Backend response:", data);

    if (!data.success || !data.payment_session_id) {
      return showToast(data.message || "Failed to create order", "error");
    }

    const orderId = data.orderId;
    console.log("Order ID:", orderId);

    if (typeof Cashfree === 'undefined') {
      return showToast("Payment SDK not loaded. Please refresh.", "error");
    }

    const cashfree = Cashfree({ mode: "production" });

    cashfree.checkout({
      paymentSessionId: data.payment_session_id,
      redirectTarget:   "_modal"
    }).then(async (result) => {
      console.log("Cashfree checkout result:", result);
      startPaymentVerification(orderId, packageData);
    }).catch(err => {
      console.error("Cashfree checkout error:", err);
      startPaymentVerification(orderId, packageData);
      document.getElementById('payment-cancel-modal')?.classList.add('visible');
    });

    setTimeout(() => {
      if (!localStorage.getItem(`paid_${orderId}`)) {
        startPaymentVerification(orderId, packageData);
      }
    }, 5000);

  } catch (err) {
    console.error("buyWithCashfree error:", err);
    showToast("Payment initialization failed. Try again.", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "CONFIRM"; }
  }
}

// ── 9. Buy Page Initialization ──
export async function initBuyPage() {
  const user = window.cashTreasureUser;
  if (!user) return;

  let profile = await getUserProfile(user.uid);

  if (!profile?.limitedOfferExpiry) {
    const expiryDate = new Date(Date.now() + 60 * 60 * 1000);
    await updateDoc(doc(db, "users", user.uid), {
      limitedOfferExpiry: Timestamp.fromDate(expiryDate)
    });
    profile.limitedOfferExpiry = Timestamp.fromDate(expiryDate);
  }

  const expiryTime    = profile.limitedOfferExpiry.toDate().getTime();
  const isOfferActive = Date.now() < expiryTime;

  const limitedCard = document.getElementById('limited-offer-card');
  if (limitedCard) limitedCard.style.display = isOfferActive ? "flex" : "none";
  if (isOfferActive) startLimitedTimer(expiryTime);

  // Clean up old listeners on pay buttons
  document.querySelectorAll('.btn-pay').forEach(btn => {
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
  });

  // Wire pay buttons → PAID ORDER RULES first
  document.querySelectorAll('.btn-pay').forEach(btn => {
    if (btn.classList.contains('btn-elite-pay')) return; // elite handled separately
    btn.addEventListener('click', () => {
      const card = btn.closest('.order-card');
      if (!card) return;
      const followers = parseInt(card.dataset.package, 10);
      const amount    = parseInt(card.dataset.amount,  10);
      currentPackageData = { followers, amount };

      // Reset coupon state for fresh flow
      resetPaidCoupon();

      // Show PAID ORDER RULES modal first
      document.getElementById('paid-rules-modal')?.classList.add('visible');
    });
  });
}

function startLimitedTimer(expiryTime) {
  if (currentTimer) clearInterval(currentTimer);
  currentTimer = setInterval(() => {
    const remaining = Math.floor((expiryTime - Date.now()) / 1000);
    if (remaining <= 0) {
      clearInterval(currentTimer);
      document.getElementById('limited-offer-card')?.style.setProperty('display', 'none');
      return;
    }
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    const timerEl = document.getElementById('timer-100');
    if (timerEl) timerEl.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;
  }, 1000);
}

// ── 10. Instagram confirm button ──
document.getElementById('confirm-instagram-btn')?.addEventListener('click', () => {
  const username = document.getElementById('paid-ig-username')?.value.trim();
  const link     = document.getElementById('paid-ig-link')?.value.trim();

  if (!username) { showToast("Please enter Instagram username", "error"); return; }
  if (link && !link.startsWith('https://www.instagram.com')) {
    showToast("Link must start with https://www.instagram.com", "error"); return;
  }

  currentPackageData.instagram_username = username;
  currentPackageData.instagram_link     = link;

  closeInstagramModal();
  setTimeout(() => buyWithCashfree(currentPackageData), 200);
});

// ── 11. Pending payment recovery ──
window.triggerPendingPaymentSuccess = async function(orderId, amount, followers) {
  if (!orderId || localStorage.getItem(`paid_${orderId}`)) return;
  await handlePaymentSuccess(orderId, {
    followers: followers || 0,
    amount:    amount    || 0,
    instagram_username: "Paid_Order",
    instagram_link:     ""
  });
};

// ── 12. Exports ──
window.initBuyPage     = initBuyPage;
window.buyWithCashfree = buyWithCashfree;


// ══════════════════════════════════════════════════
// ELITE/MEMBER EXCLUSIVE PAID ORDERS
// ══════════════════════════════════════════════════

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-elite-pay');
  if (!btn) return;

  const user = window.cashTreasureUser;
  if (!user) return showToast("Please login first", "error");

  const minLevel = parseInt(btn.dataset.minLevel) || 4;

  try {
    const profile = await getUserProfile(user.uid);
    const userLevel = profile?.level || 1;

    if (userLevel < minLevel) {
      return showToast("ONLY FOR PRIME ELITE & MEMBER", "error");
    }

    // Check if already ordered this month
    const now = new Date();
    const monthKey = `elite_order_${now.getFullYear()}_${now.getMonth()}`;
    const lastEliteOrder = profile?.lastEliteOrderMonth || "";

    if (lastEliteOrder === monthKey) {
      return showToast("UNAVAILABLE — Already ordered this month", "error");
    }

    const card = btn.closest('.order-card');
    if (!card) return;

    const followers = parseInt(card.dataset.package, 10);
    const amount = parseInt(card.dataset.amount, 10);
    currentPackageData = { followers, amount, isEliteOrder: true };

    // Show paid rules modal
    document.getElementById('paid-rules-modal')?.classList.add('visible');

  } catch (err) {
    console.error("Elite pay error:", err);
    showToast("Something went wrong", "error");
  }
});

// After successful elite order, mark the month
const origHandlePaymentSuccess = handlePaymentSuccess;

// We need to hook into the success handler to track elite monthly orders
// This is done by checking currentPackageData.isEliteOrder after payment
window.addEventListener('eliteOrderComplete', async (e) => {
  try {
    const user = window.cashTreasureUser;
    if (!user) return;
    const now = new Date();
    const monthKey = `elite_order_${now.getFullYear()}_${now.getMonth()}`;
    await updateDoc(doc(db, "users", user.uid), {
      lastEliteOrderMonth: monthKey
    });
  } catch (err) {
    console.warn("Elite order tracking error:", err);
  }
});


// ══════════════════════════════════════════════════
// DIAMOND LOCK SYSTEM (Buy Page paid cards)
// ══════════════════════════════════════════════════

const lockTimers = {};

async function refreshLockState() {
  const user = window.cashTreasureUser;
  if (!user) return;
  const profile = await getUserProfile(user.uid);
  const unlocks = profile?.diamondUnlocks || {};

  document.querySelectorAll('.diamond-lockable').forEach(card => {
    const key = card.dataset.unlockKey;
    if (!key) return;
    const overlay = document.getElementById(`lock-overlay-${key}`);
    const banner = document.getElementById(`deal-banner-${key}`);
    const unlockUntil = unlocks[key] || 0;
    if (unlockUntil > Date.now()) {
      if (overlay) overlay.classList.add('hidden');
      if (banner) banner.style.display = 'flex';
      startLockTimer(key, unlockUntil);
    } else {
      if (overlay) overlay.classList.remove('hidden');
      if (banner) banner.style.display = 'none';
      if (lockTimers[key]) clearInterval(lockTimers[key]);
    }
  });
}

function startLockTimer(key, unlockUntil) {
  if (lockTimers[key]) clearInterval(lockTimers[key]);
  const timerEl = document.getElementById(`deal-timer-${key}`);
  const overlay = document.getElementById(`lock-overlay-${key}`);
  const banner = document.getElementById(`deal-banner-${key}`);
  lockTimers[key] = setInterval(() => {
    const remaining = unlockUntil - Date.now();
    if (remaining <= 0) {
      clearInterval(lockTimers[key]);
      if (overlay) overlay.classList.remove('hidden');
      if (banner) banner.style.display = 'none';
      return;
    }
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    if (timerEl) timerEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }, 1000);
}

function showDiamondUnlockPopup(unlockKey) {
  document.querySelectorAll('.diamond-unlock-popup').forEach(el => el.remove());
  const popup = document.createElement('div');
  popup.className = 'diamond-unlock-popup';
  popup.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.85); display:flex;
    align-items:center; justify-content:center; z-index:99999;
    backdrop-filter:blur(14px);
  `;
  popup.innerHTML = `
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:24px;
                padding:32px 24px;text-align:center;max-width:360px;width:92%;
                box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div style="font-size:50px;margin-bottom:10px;">🔒</div>
      <h2 style="color:#fff;font-size:22px;font-weight:900;">UNLOCK IT</h2>
      <p style="color:#e2e8f0;margin:16px 0;">This deal of <b>2000 followers for ₹199</b> will unlock for <b>60 minutes</b> if you give 1 💎!</p>
      <button class="diamond-unlock-btn" id="do-diamond-unlock" style="width:100%;padding:16px;border:none;border-radius:50px;background:linear-gradient(135deg,#FFD700,#FFA500);color:#1a1a2e;font-weight:900;">
        Give <img src="images/diamondgift.png" style="width:22px;height:22px;vertical-align:middle;margin:0 4px;"> 1 Diamond
      </button>
      <button id="cancel-diamond-unlock" style="width:100%;margin-top:12px;padding:12px;border:none;border-radius:50px;background:transparent;color:#94a3b8;">Cancel</button>
    </div>`;
  document.body.appendChild(popup);

  document.getElementById('cancel-diamond-unlock').onclick = () => popup.remove();
  popup.onclick = (e) => { if (e.target === popup) popup.remove(); };

  document.getElementById('do-diamond-unlock').onclick = async () => {
    const user = window.cashTreasureUser;
    if (!user) return showToast("Please login first", "error");
    const btn = document.getElementById('do-diamond-unlock');
    btn.disabled = true;
    btn.textContent = '⏳ Unlocking...';
    try {
      const resp = await fetch(`${RAILWAY_URL}/diamond-unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, unlockKey })
      });
      const r = await resp.json();
      if (!r.success) {
        btn.disabled = false;
        btn.innerHTML = 'Give <img src="images/diamondgift.png" style="width:22px;height:22px;vertical-align:middle;margin:0 2px;">';
        return showToast(r.message || "Unlock failed", "error");
      }
      const diamondEl = document.getElementById("diamond-count");
      if (diamondEl && r.newDiamonds !== undefined) diamondEl.textContent = r.newDiamonds;
      popup.remove();
      showToast("🔓 Unlocked for 1 hour!", "success");
      const overlay = document.getElementById(`lock-overlay-${unlockKey}`);
      const banner = document.getElementById(`deal-banner-${unlockKey}`);
      if (overlay) overlay.classList.add('hidden');
      if (banner) banner.style.display = 'flex';
      startLockTimer(unlockKey, r.unlockUntil);
    } catch (err) {
      console.error("Unlock error:", err);
      btn.disabled = false;
      btn.innerHTML = 'Give <img src="images/diamondgift.png" style="width:22px;height:22px;vertical-align:middle;margin:0 2px;">';
      showToast("Network error", "error");
    }
  };
}

// Wire lock overlays + block locked pay buttons (called after buy page init)
function wireLockSystem() {
  document.querySelectorAll('.diamond-lock-overlay').forEach(overlay => {
    if (overlay.dataset.wired === 'true') return;
    overlay.dataset.wired = 'true';
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = overlay.closest('.diamond-lockable');
      const key = card?.dataset.unlockKey;
      if (key) showDiamondUnlockPopup(key);
    });
  });

  // Block pay button if locked
  document.querySelectorAll('.diamond-lockable .btn-pay').forEach(btn => {
    if (btn.dataset.lockWired === 'true') return;
    btn.dataset.lockWired = 'true';
    btn.addEventListener('click', (e) => {
      const card = btn.closest('.diamond-lockable');
      const key = card?.dataset.unlockKey;
      const overlay = document.getElementById(`lock-overlay-${key}`);
      if (overlay && !overlay.classList.contains('hidden')) {
        e.stopImmediatePropagation();
        e.preventDefault();
        showDiamondUnlockPopup(key);
      }
    }, true); // capture — runs first
  });
}

// Hook into buy page open
window.addEventListener("userReady", () => {
  setTimeout(() => { refreshLockState(); wireLockSystem(); }, 1200);
});

// Also refresh whenever buy page nav is clicked
document.querySelector('.nav-item[data-page="buy"]')?.addEventListener('click', () => {
  setTimeout(() => { refreshLockState(); wireLockSystem(); }, 400);
});

console.log("✅ Pay module (with coupons) loaded.");