// ================================
// Prime Follower - Main Application Script
// ================================

// ── 1. Imports ────────────────────────────────────────────────────────────────

import {
  auth, db,
  onAuthStateChanged,
  doc, updateDoc
} from "./firebase.js";

import {
  getUserProfile,
  createUserProfile,
  logTransaction
} from "./firebase.js";

import {
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  onSnapshot,
  increment,
  getDoc,
  query,
  collection,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { initReferPage } from "./refer.js";
import { initLevelSystem } from "./level.js";




// Force persistent login — prevents auto-logout on tab close / refresh
await setPersistence(auth, browserLocalPersistence);

// ── 2. Global Config & Constants ─────────────────────────────────────────────

const AVATAR_COUNT = 10;
const SITE_URL = window.location.href;
const ORDER_LOGOS = ["icons/insta.png", "icons/instagram.png"];

// Global user state — readable by other modules (pay.js, dailycheckin.js, etc.)
window.cashTreasureUser = null;
window.pendingRewardType = null;

// ── 3. Utility Functions ─────────────────────────────────────────────────────

/**
 * Displays a dismissing toast notification.
 * @param {string} message
 * @param {"success"|"error"} type
 */
function showToast(message, type = "success") {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Make showToast globally accessible for other modules
window.showToast = showToast;

/**
 * Returns true only on a genuine mobile device
 * (UA + touch + coarse pointer + small screen).
 */
function isRealMobile() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  return (
    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua) &&
    (navigator.maxTouchPoints > 0 || "ontouchstart" in window) &&
    window.matchMedia("(pointer: coarse)").matches &&
    window.innerWidth <= 768 &&
    window.innerHeight <= 1024
  );
}

/**
 * Detects if browser DevTools are open via size heuristic.
 */
function detectDevTools() {
  const threshold = 160;
  return (
    window.outerWidth - window.innerWidth > threshold ||
    window.outerHeight - window.innerHeight > threshold
  );
}

/**
 * Probes Google Ad servers to detect Private DNS / ad-blocking.
 * Resolves true if blocked, false if reachable.
 */
function detectPrivateDNS() {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
    const timer = setTimeout(() => resolve(true), 1400);
    img.onload = () => { clearTimeout(timer); resolve(false); };
    img.onerror = () => { clearTimeout(timer); resolve(true); };
  });
}

// ── 4. Security & Device Enforcement ─────────────────────────────────────────

/** Shows/hides the desktop-blocking overlay based on device detection. */
function enforceMobileOnly() {
  const overlay = document.getElementById("desktop-overlay");
  if (!overlay) return;
  overlay.style.display = isRealMobile() ? "none" : "flex";
  document.documentElement.style.overflow = isRealMobile() ? "" : "hidden";
}

// Run on load and whenever the viewport changes
enforceMobileOnly();
window.addEventListener("resize", enforceMobileOnly);
window.addEventListener("orientationchange", enforceMobileOnly);
setInterval(enforceMobileOnly, 1500);

// Disable right-click and common DevTools shortcuts
document.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("keydown", e => {
  if (
    e.key === "F12" ||
    (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
    (e.ctrlKey && e.key === "U")
  ) {
    e.preventDefault();
  }
});

/** Shows a DNS warning sheet if Private DNS / ad-blocking is detected. */
async function showDNSWarningIfNeeded() {
  const isBlocked = await detectPrivateDNS();
  if (!isBlocked) return;

  const overlay = document.getElementById("dns-warning-overlay");
  if (!overlay) return;

  overlay.style.display = "flex";

  document.getElementById("dns-disable-btn")?.addEventListener("click", () => {
    overlay.style.display = "none";
    if (window.Android?.closeApp) {
      Android.closeApp();
    } else {
      showToast("Please disable Private DNS and reopen the app.", "error");
    }
  }, { once: true });
}

// ── 5. UI Helpers ─────────────────────────────────────────────────────────────

/** Sets avatar src on both the floating button and the profile modal. */
function applyAvatar(avatarFilename) {
  const path = "avatars/" + (avatarFilename || "user1.jpg");
  const floatingAvatar = document.getElementById("user-avatar");
  const profileAvatar = document.getElementById("profile-avatar-img");
  if (floatingAvatar) {
    floatingAvatar.src = path;
    floatingAvatar.onerror = () => { floatingAvatar.src = 'images/user.png'; };
  }
  if (profileAvatar) {
    profileAvatar.src = path;
    profileAvatar.onerror = () => { profileAvatar.src = 'images/user.png'; };
  }
}

/** Renders the avatar picker grid and highlights the user's current avatar. */
async function loadAvatars() {
  const grid = document.getElementById("avatar-grid");
  if (!grid) return;

  let html = "";
  for (let i = 1; i <= AVATAR_COUNT; i++) {
    html += `<div class="avatar-item" data-avatar="user${i}.jpg">
               <img src="avatars/user${i}.jpg">
             </div>`;
  }
  grid.innerHTML = html;

  // Highlight the user's currently saved avatar
  const uid = window.cashTreasureUser?.uid;
  if (!uid) return;
  const profile = await getUserProfile(uid);
  grid.querySelectorAll(".avatar-item").forEach(el => {
    el.classList.toggle("active", el.dataset.avatar === profile.avatar);
  });
}

/** Initialises the QR code modal (lazy — generates QR only once). */
function initQRModal() {
  document.getElementById("qr-site-link").value = SITE_URL;

  document.getElementById("btn-show-qr").addEventListener("click", () => {
    const modal = document.getElementById("qr-modal");
    modal.classList.add("visible");

    const container = document.getElementById("qr-code-container");
    if (!container.hasChildNodes()) {
      new QRCode(container, {
        text: SITE_URL,
        width: 200,
        height: 200,
        colorDark: "#1a1a2e",
        colorLight: "#ffffff"
      });
    }
  });

  document.getElementById("qr-modal-close").addEventListener("click", () => {
    document.getElementById("qr-modal").classList.remove("visible");
  });

  document.getElementById("btn-copy-link").addEventListener("click", () => {
    navigator.clipboard.writeText(SITE_URL).then(() => {
      const btn = document.getElementById("btn-copy-link");
      btn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
    });
  });
}

/** Animates the order-page Instagram logo between two icons. */
function initOrderLogoAnimation() {
  const logo = document.getElementById("order-logo");
  if (!logo) return;
  let index = 0;
  setInterval(() => {
    index = (index + 1) % ORDER_LOGOS.length;
    logo.style.transform = "scale(1.15)";
    logo.src = ORDER_LOGOS[index];
    setTimeout(() => { logo.style.transform = "scale(1)"; }, 200);
  }, 1300);
}

// ── 6. Navigation System ─────────────────────────────────────────────────────

const navItems = document.querySelectorAll(".nav-item[data-page]");
const pageSections = document.querySelectorAll(".page-section");

/** Switches the visible page section and updates the bottom nav highlight. */
function navigateTo(pageId) {
  pageSections.forEach(s => s.classList.remove("active"));
  navItems.forEach(n => n.classList.remove("active"));

  const target = document.getElementById(`page-${pageId}`);
  if (target) target.classList.add("active");

  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add("active");

  // Scroll to top when any page opens
  window.scrollTo(0, 0);
  document.getElementById("app-container")?.scrollTo(0, 0);
  if (target) target.scrollTo(0, 0);

  // Restart PRIME VIRAL BONUS carousel when page opens
  if (pageId === "refer") {
    window.dispatchEvent(new CustomEvent("referPageOpened"));
  }
}
navItems.forEach(item => {
  item.addEventListener("click", async () => {
    const page = item.dataset.page;
    navigateTo(page);

    // Initialise Buy Followers page on first visit
    if (page === "buy" && typeof window.initBuyPage === "function") {
      await window.initBuyPage();
    }
  });
});

// Allow other modules/pages to trigger navigation
window.navigateTo = navigateTo;

// ── 7. Firebase Auth & User Management ───────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
  const logoutBtn = document.getElementById("btn-logout");

  // ── Guest / Signed-out State ──
  if (!user) {
    document.getElementById("profile-username").textContent = "Guest";
    document.getElementById("profile-email").textContent = "Please sign in to start earning credits";
    document.getElementById("profile-credits").textContent = "0";
    document.getElementById("profile-total-earned").textContent = "0";
    document.getElementById("profile-joined").textContent = "-";

    logoutBtn.innerHTML = '<span class="signin-text">🚀 SIGN IN</span>';
    logoutBtn.classList.add("signin-btn");
    logoutBtn.onclick = () => { window.location.href = "FIXSIGNIN/index.html"; };
    return;
  }

  // ── Signed-in State ──
  await createUserProfile(user.uid, { email: user.email, username: user.displayName || "" });
  const profile = await getUserProfile(user.uid);

  const credits = profile?.credits || 0;
  const username = profile?.username || user.displayName || "User";
  const email = user.email || "";

  // Populate UI
  applyAvatar(profile?.avatar);
  document.getElementById("credit-count").textContent = credits;
  document.getElementById("profile-username").textContent = username;
  document.getElementById("profile-email").textContent = email;
  document.getElementById("profile-credits").textContent = credits;
  document.getElementById("profile-total-earned").textContent = profile?.total_earned || 0;

  if (profile?.created_at) {
    document.getElementById("profile-joined").textContent =
      profile.created_at.toDate().toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric"
      });
  }

    // Referral code generation is now handled by firebase.js createUserProfile migration
    // Re-fetch profile to get any migrated fields
    if (profile && !profile.referralCode) {
      const freshProfile = await getUserProfile(user.uid);
      if (freshProfile) {
        Object.assign(profile, freshProfile);
      }
    }

    // Populate global user state
    window.cashTreasureUser = {
      uid: user.uid,
      email,
      username,
      credits,
      avatar: profile?.avatar || "user1.jpg",
      total_followers_ordered: profile?.total_followers_ordered || 0
    };
  // Live Firestore sync — updates credits and ad count in real time
  onSnapshot(doc(db, "users", user.uid), (snap) => {
    const data = snap.data();
    if (!data) return;

    const liveCredits = data.credits || 0;
    const displayLive = Number.isInteger(liveCredits) ? liveCredits : parseFloat(liveCredits.toFixed(1));
    document.getElementById("credit-count").textContent = displayLive;
    document.getElementById("profile-credits")?.textContent !== undefined &&
      (document.getElementById("profile-credits").textContent = displayLive);

    const adCountEl = document.getElementById("ad-count");
    const userAdLimit = data.current_ad_limit || 20;
    if (adCountEl) adCountEl.textContent = `${data.daily_ads_watched || 0} / ${userAdLimit} ads today`;

    // Keep global state in sync
    window.cashTreasureUser.credits = liveCredits;
    window.cashTreasureUser.total_followers_ordered = data.total_followers_ordered || 0;

    // Update diamonds
    const liveDiamonds = data.diamonds || 0;
    const diamondEl = document.getElementById("diamond-count");
    if (diamondEl) diamondEl.textContent = Math.floor(liveDiamonds);
  });

// Notify other modules that user data is ready
window.dispatchEvent(
  new CustomEvent("userReady", {
    detail: window.cashTreasureUser
  })
);

// Init Refer Page
initReferPage(window.cashTreasureUser);

// Init Level System
initLevelSystem(user.uid);


    // Show welcome diamond overlay if the user has NEVER been granted the welcome diamond
    if (profile && profile.welcomeDiamondGranted !== true) {
      // Delay so refer code overlay shows first
      setTimeout(() => showWelcomeDiamondOverlay(user.uid), 4000);
    }

    // Show "Enter Refer Code" overlay ONLY for brand new signups (account created within last 60 seconds)
    try {
      if (profile && !profile.referCodeEntered && !profile.referredBy) {
        const createdAt = profile.created_at?.toDate?.();
        const isNewUser = createdAt && (Date.now() - createdAt.getTime()) < 60000;
        if (isNewUser) {
          showReferCodeEntryOverlay(user.uid);
        } else {
          // Old user — silently mark as entered so they never see it
          await updateDoc(doc(db, "users", user.uid), { referCodeEntered: true });
        }
      }
    } catch (referErr) {
      console.warn("[ReferCode] Non-critical error:", referErr);
    }
});

// ── Refer Code Entry Overlay ─────────────────────────────────────────────────

function showReferCodeEntryOverlay(uid) {
  document.querySelectorAll('.refer-code-entry-overlay').forEach(el => el.remove());

  const overlay = document.createElement("div");
  overlay.className = "refer-code-entry-overlay";
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.85); display:flex;
    align-items:center; justify-content:center; z-index:99999;
    backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
  `;

  overlay.innerHTML = `
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b); border-radius:24px;
                padding:32px 24px; text-align:center; max-width:360px; width:92%;
                box-shadow:0 20px 60px rgba(0,0,0,0.5); border:2px solid rgba(79,172,254,0.3);">
      <div style="font-size:45px; margin-bottom:10px;">🎁</div>
      <h2 style="color:#fff; font-size:22px; font-weight:900; margin-bottom:6px;">
        Refer & Earn
      </h2>
      <p style="color:rgba(255,255,255,0.7); font-size:14px; margin-bottom:20px;">
        Do you have a referral code?
      </p>
      <div style="position:relative; margin-bottom:18px;">
        <input id="refer-code-input" type="text" maxlength="11"
               style="width:100%; padding:16px 18px; border-radius:14px;
                      border:2px solid rgba(79,172,254,0.3); background:rgba(255,255,255,0.08);
                      color:#fff; font-size:16px; font-weight:700; text-align:center;
                      letter-spacing:2px; outline:none; text-transform:uppercase;"
               placeholder="">
        <span id="refer-code-placeholder" style="position:absolute; top:50%; left:50%;
              transform:translate(-50%,-50%); color:rgba(255,255,255,0.3); font-size:14px;
              font-weight:600; pointer-events:none;">Optional</span>
      </div>
      <button id="refer-code-confirm-btn" style="
        width:100%; padding:16px; border:none; border-radius:50px; font-size:17px;
        font-weight:800; cursor:pointer; color:#fff;
        background:linear-gradient(135deg,#ff6b81,#ff4466);
        box-shadow:0 8px 25px rgba(255,68,102,0.4); margin-bottom:12px;
      ">Confirm</button>
      <button id="refer-code-skip-btn" style="
        width:100%; padding:14px; border:none; border-radius:50px; font-size:14px;
        font-weight:600; cursor:pointer; color:#94a3b8; background:rgba(255,255,255,0.08);
      ">I don't have a refer code</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const input = document.getElementById("refer-code-input");
  const placeholder = document.getElementById("refer-code-placeholder");
  const confirmBtn = document.getElementById("refer-code-confirm-btn");
  const skipBtn = document.getElementById("refer-code-skip-btn");

  // Remove placeholder on focus
  input.addEventListener("focus", () => { placeholder.style.display = "none"; });
  input.addEventListener("blur", () => {
    if (!input.value.trim()) placeholder.style.display = "block";
  });

  // Skip button — close overlay, mark as entered
  skipBtn.addEventListener("click", async () => {
    try {
      await updateDoc(doc(db, "users", uid), { referCodeEntered: true });
    } catch (e) { console.warn(e); }
    overlay.remove();
  });

  // Confirm button — verify code
  confirmBtn.addEventListener("click", async () => {
    const code = input.value.trim().toUpperCase();

    if (!code) {
      showToast("Please enter a referral code", "error");
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Verifying...";
    confirmBtn.style.opacity = "0.6";

    try {
      // Search for user with this referral code
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("referralCode", "==", code));
      const snap = await getDocs(q);

      if (snap.empty) {
        showToast("Invalid code", "error");
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm";
        confirmBtn.style.opacity = "1";
        return;
      }

      const inviterDoc = snap.docs[0];
      const inviterUid = inviterDoc.id;

      // Can't refer yourself
      if (inviterUid === uid) {
        showToast("You can't use your own code", "error");
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm";
        confirmBtn.style.opacity = "1";
        return;
      }

      // Save referral
      await updateDoc(doc(db, "users", uid), {
        referredBy: inviterUid,
        referCodeEntered: true
      });

      // Show success after 3 seconds
      confirmBtn.textContent = "Verifying...";
      setTimeout(() => {
       showToast("Successful", "success");
overlay.remove();

// Show 50 Free Followers reward 30 seconds after successful referral code entry
setTimeout(() => {
  const user = window.cashTreasureUser;
  if (user) showDay3ReferralRewardOverlay(user.uid);
}, 30000);
      }, 3000);

    } catch (err) {
      console.error("[ReferCode] Error:", err);
      showToast("Something went wrong. Try again.", "error");
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Confirm";
      confirmBtn.style.opacity = "1";
    }
  });
}



// Listen for completed payments even if user closed app
async function checkPendingPayments(uid) {
  try {
    const q = query(
      collection(db, "payment_events"),
      where("userId", "==", uid),
      where("processed", "==", false)
    );
    const snap = await getDocs(q);

    for (const payDoc of snap.docs) {
      const data = payDoc.data();
      // Mark as processed first to prevent double-firing
      await updateDoc(payDoc.ref, { processed: true });
      // Delegate to pay.js handler via polling trigger
      if (window.triggerPendingPaymentSuccess) {
        await window.triggerPendingPaymentSuccess(data.orderId, data.amount, data.followers || 0);
      }
    }
  } catch (err) {
    console.error("[checkPendingPayments] Error:", err);
  }
}

// Call it after userReady
window.addEventListener("userReady", (e) => {
  const uid = e.detail?.uid || e.detail;
  if (uid) checkPendingPayments(uid);
});


// ── 8. Event Listeners ───────────────────────────────────────────────────────

// ─ Avatar Selection ─
let selectedAvatar = null;

document.addEventListener("click", e => {
  const item = e.target.closest(".avatar-item");
  if (!item) return;
  selectedAvatar = item.dataset.avatar;
  document.querySelectorAll(".avatar-item").forEach(el => el.classList.remove("active"));
  item.classList.add("active");
});

document.getElementById("avatar-close-btn")?.addEventListener("click", () => {
  navigateTo("home");
});

document.getElementById("confirm-avatar-btn").addEventListener("click", async () => {
  if (!window.cashTreasureUser || !selectedAvatar) {
    showToast("Please select an avatar first", "error");
    return;
  }

  try {
    await updateDoc(doc(db, "users", window.cashTreasureUser.uid), { avatar: selectedAvatar });
    applyAvatar(selectedAvatar);
    window.cashTreasureUser.avatar = selectedAvatar;
    showToast("Avatar updated successfully", "success");
    navigateTo("home");
  } catch (err) {
    console.error(err);
    showToast("Error updating avatar", "error");
  }
});

document.getElementById("profile-avatar-click").addEventListener("click", () => {
  document.getElementById("profile-modal").classList.remove("visible");
  document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
  document.getElementById("page-avatar").classList.add("active");
  loadAvatars();
});

// ─ Profile Modal ─
document.getElementById("floating-profile").addEventListener("click", () => {
  document.getElementById("profile-modal").classList.add("visible");
});

document.getElementById("profile-close").addEventListener("click", () => {
  document.getElementById("profile-modal").classList.remove("visible");
});

document.getElementById("profile-modal").addEventListener("click", e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove("visible");
});

// ─ Order Detail Modal ─
window.closeOrderDetails = function () {
  document.getElementById("order-detail-modal")?.classList.remove("visible");
};

// ─ Open Buy Page from Order Card ─
document.getElementById("btn-open-buy")?.addEventListener("click", async () => {
  openImagePopup('images/buy.jpg', async () => {
    navigateTo("buy");
    if (typeof window.initBuyPage === "function") await window.initBuyPage();
  });
});

// ─ Rewarded Ad Callback (called by Android WebView after ad completes) ─
window.onAdRewarded = async function () {
  const user = window.cashTreasureUser;
  if (!user) return;

  if (window.pendingRewardType === "watch_ad") {
    try {
      const resp = await fetch('https://payment-backend-production-0b8d.up.railway.app/watch-ad-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const r = await resp.json();
      if (!r.success) {
        showToast(r.message || "Could not add credit", "error");
      } else {
        user.credits = r.newCredits;
        const displayCredits = Number.isInteger(r.newCredits) ? r.newCredits : r.newCredits.toFixed(1);
        const ccEl = document.getElementById("credit-count");
        if (ccEl) ccEl.textContent = displayCredits;
        const adCountEl = document.getElementById("ad-count");
        if (adCountEl) adCountEl.textContent = `${r.adsWatched} / ${r.adLimit} ads today`;
        const rewardDisplay = Number.isInteger(r.reward) ? `+${r.reward}` : `+${r.reward.toFixed(1)}`;
        showToast(`${rewardDisplay} Credit Added 🎉`);

        // Refresh checkin display
        const freshProfile = await getDoc(doc(db, "users", user.uid));
        window.renderCheckin?.(freshProfile.data());
      }
    } catch (e) {
      console.error("Watch ad reward error:", e);
      showToast("Network error", "error");
    }
  }

  if (window.pendingRewardType === "daily_checkin") {
    await window.onDailyCheckinRewarded?.();
  }

  window.pendingRewardType = null;
};

// ─ Watch Ad Button → Android Ad ─
document.getElementById("btn-watch-ad")?.addEventListener("click", () => {
  if (window.Android) {
    window.pendingRewardType = "watch_ad";
    Android.showAd();
  }
});

// ── 9. Initialization ─────────────────────────────────────────────────────────

// Force hide loader after exactly 2 seconds + safety fallback
// Force Loader Hide - Max 2.5 seconds
// Hide loader after 2.5s — independent of window.load (safer for localhost)
function hidePrimeLoader() {
  const loader = document.getElementById("load2s-overlay");
  if (!loader) return;

  loader.style.transition = "opacity 0.5s ease";
  loader.style.opacity = "0";

  setTimeout(() => {
    loader.style.display = "none";
  }, 500);
}

// Run loader hide on a fixed timer (works even if window.load is delayed)
setTimeout(hidePrimeLoader, 2500);

// Emergency fallback
setTimeout(() => {
  const loader = document.getElementById("load2s-overlay");
  if (loader && loader.style.display !== "none") {
    loader.style.display = "none";
  }
}, 4000);

// DNS check after window load (or fallback)
window.addEventListener("load", () => {
  showDNSWarningIfNeeded();
});
setTimeout(() => showDNSWarningIfNeeded(), 3500);

// Apply dark mode preference
if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark");
}

// Restore home page after a reload-redirect
if (localStorage.getItem("goHomeAfterReload") === "true") {
  localStorage.removeItem("goHomeAfterReload");
  setTimeout(() => navigateTo("home"), 100);
}

// One-time module setup
initQRModal();
initOrderLogoAnimation();
loadAvatars();



// ================================
// PRIME AI DRAGGABLE FLOATING BUTTON (Bottom Right Default)
// ================================

const primeFloatBtn = document.getElementById('prime-ai-float-btn');

if (primeFloatBtn) {
  let isDragging = false;
  let startY = 0;
  let startX = 0;
  let currentBottom = 90;
  let currentRight = 20;
  let longPressTimer = null;

  // Load saved position
  const savedBottom = localStorage.getItem('primeBtnBottom');
  const savedRight = localStorage.getItem('primeBtnRight');

  if (savedBottom) primeFloatBtn.style.bottom = savedBottom;
  if (savedRight) primeFloatBtn.style.right = savedRight;

  // Long press to start dragging
  primeFloatBtn.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    currentBottom = parseFloat(primeFloatBtn.style.bottom) || 90;
    currentRight = parseFloat(primeFloatBtn.style.right) || 20;

    longPressTimer = setTimeout(() => {
      isDragging = true;
      primeFloatBtn.style.transition = 'none';
      primeFloatBtn.style.opacity = '0.85';
    }, 280);
  });

  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;

    const touchY = e.touches[0].clientY;
    const touchX = e.touches[0].clientX;

    const deltaY = startY - touchY;
    const deltaX = startX - touchX;

    let newBottom = currentBottom + deltaY;
    let newRight = currentRight + deltaX;

    // Keep button visible and prevent overlapping bottom nav
    newBottom = Math.max(20, Math.min(newBottom, window.innerHeight - 140));
    newRight = Math.max(10, Math.min(newRight, window.innerWidth - 80));

    primeFloatBtn.style.bottom = newBottom + 'px';
    primeFloatBtn.style.right = newRight + 'px';
  });

  document.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);

    if (isDragging) {
      isDragging = false;
      primeFloatBtn.style.transition = 'transform 0.2s, bottom 0.3s, right 0.3s';
      primeFloatBtn.style.opacity = '1';

      // Save position
      localStorage.setItem('primeBtnBottom', primeFloatBtn.style.bottom);
      localStorage.setItem('primeBtnRight', primeFloatBtn.style.right);
    }
  });

  // Click to open PRIME folder
  primeFloatBtn.addEventListener('click', (e) => {
    if (isDragging) {
      isDragging = false;
      return;
    }
    window.location.href = 'PRIME/index.html';
  });
}


// ══════════════════════════════════════════════════
// WELCOME DIAMOND OVERLAY (New Users)
// ══════════════════════════════════════════════════

function showWelcomeDiamondOverlay(uid) {
  document.querySelectorAll('.welcome-diamond-overlay').forEach(el => el.remove());

  const overlay = document.createElement("div");
  overlay.className = "welcome-diamond-overlay";
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.9); display:flex;
    align-items:center; justify-content:center; z-index:99999;
    backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px);
  `;

  overlay.innerHTML = `
    <div style="background:linear-gradient(135deg,#0f172a,#1e1b4b,#1e3a8a); border-radius:28px;
                padding:36px 28px; text-align:center; max-width:360px; width:92%;
                box-shadow:0 0 60px rgba(96,165,250,0.4),0 20px 60px rgba(0,0,0,0.6);
                border:3px solid rgba(96,165,250,0.5); position:relative; overflow:hidden;">
      <div style="position:absolute;top:-50%;left:-150%;width:60%;height:300%;
                  background:linear-gradient(120deg,transparent,rgba(255,255,255,0.15),transparent);
                  transform:skewX(-25deg); animation:shine 2.5s linear infinite;"></div>
      <div style="font-size:55px; margin-bottom:10px;">🎉</div>
      <h2 style="color:#FFD700; font-size:24px; font-weight:900; margin-bottom:8px;
                 text-shadow:0 0 20px rgba(255,215,0,0.5);">
        WELCOME TO PRIME!
      </h2>
      <p style="color:#fff; font-size:18px; font-weight:700; margin-bottom:6px;">
        YOU WON A FREE DIAMOND!
      </p>
      <img src="images/diamondgift.png" style="width:80px; height:80px; margin:12px auto; display:block;
           filter:drop-shadow(0 0 20px rgba(96,165,250,0.8));">
      <p style="color:rgba(255,255,255,0.7); font-size:14px; margin-bottom:22px;">
        Here's a welcome gift to start your journey!
      </p>
      <button id="welcome-diamond-btn" style="
        width:100%; padding:18px; border:none; border-radius:50px; font-size:18px;
        font-weight:900; cursor:pointer; color:#1a1a2e;
        background:linear-gradient(135deg,#FFD700,#ffed4e,#FFA500);
        box-shadow:0 0 30px rgba(255,215,0,0.5),0 8px 25px rgba(255,165,0,0.4);
      ">💎 COLLECT DIAMOND</button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("welcome-diamond-btn").addEventListener("click", async () => {
    const wbtn = document.getElementById("welcome-diamond-btn");
    wbtn.disabled = true;
    try {
      const resp = await fetch('https://payment-backend-production-0b8d.up.railway.app/diamond-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid })
      });
      const r = await resp.json();
      overlay.remove();
      if (r.success) {
        window.showToast?.("💎 Welcome Diamond Collected!", "success");
        const diamondEl = document.getElementById("diamond-count");
        if (diamondEl && r.diamonds !== undefined) diamondEl.textContent = r.diamonds;
      }
    } catch (e) {
      console.warn(e);
      overlay.remove();
    }
  });
}



// ══════════════════════════════════════════════════
// DIAMOND SYSTEM
// ══════════════════════════════════════════════════

function updateDiamondDisplay(diamonds) {
  const el = document.getElementById("diamond-count");
  if (el) el.textContent = Math.floor(diamonds || 0);
}

// Update diamond on user ready
window.addEventListener("userReady", async (e) => {
  const profile = await getUserProfile(e.detail.uid);
  if (profile) updateDiamondDisplay(profile.diamonds || 0);
});

// Live sync diamonds
// This is handled inside the existing onSnapshot — we'll add it there

// ══════════════════════════════════════════════════
// IMAGE OVERLAY SYSTEM (Diamond page, Credit page, Buy page, Drop page)
// ══════════════════════════════════════════════════

function openImagePopup(imageSrc, onCloseCallback) {
  document.querySelectorAll('.image-overlay-popup').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'image-overlay-popup';
  overlay.innerHTML = `
    <div class="overlay-img-wrapper">
      <button class="image-overlay-close" id="img-overlay-close">✕</button>
      <img src="${imageSrc}" class="overlay-main-img">
    </div>
  `;

  overlay.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  
  // Close on background tap (not on image)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      if (onCloseCallback) onCloseCallback();
    }
  });

  document.body.appendChild(overlay);

  document.getElementById('img-overlay-close').addEventListener('click', () => {
    overlay.remove();
    if (onCloseCallback) onCloseCallback();
  });
}

// Make globally accessible
window.openImagePopup = openImagePopup;

// Diamond floating block click → open diamond page
document.getElementById('floating-diamond')?.addEventListener('click', () => {
  openImagePopup('images/diamondpage.png');
});

document.getElementById('floating-credits')?.addEventListener('click', () => {
  openImagePopup('images/creditpage.png');
});

// "How" link on buy page → open drop.jpg
// Already handled in pay.js, but we need to update buy.jpg for BUY NOW



// ══════════════════════════════════════════════════
// INSTAGRAM CONNECT SYSTEM
// ══════════════════════════════════════════════════

function loadConnectedInstagram() {
  const saved = localStorage.getItem('connectedInstagram');
  if (!saved) return null;
  try { return JSON.parse(saved); } catch { return null; }
}

function saveConnectedInstagram(data) {
  localStorage.setItem('connectedInstagram', JSON.stringify(data));
}

function clearConnectedInstagram() {
  localStorage.removeItem('connectedInstagram');
}

function renderInstagramConnectState() {
  const data = loadConnectedInstagram();
  const notConnected = document.getElementById('ig-not-connected');
  const connected = document.getElementById('ig-connected');
  if (!notConnected || !connected) return;

  if (!data) {
    notConnected.style.display = 'block';
    connected.style.display = 'none';
    return;
  }

  notConnected.style.display = 'none';
  connected.style.display = 'block';

  const picEl = document.getElementById('ig-profile-pic');
  if (picEl) {
    const RW = 'https://payment-backend-production-0b8d.up.railway.app';
    if (data.profilePicBase64 && data.profilePicBase64.startsWith('data:')) {
      picEl.src = data.profilePicBase64;
    } else if (data.profilePic) {
      // Use server image proxy to bypass 403
      picEl.src = `${RW}/ig-image?url=${encodeURIComponent(data.profilePic)}`;
    } else {
      picEl.src = 'images/user.png';
    }
    picEl.onerror = () => { picEl.src = 'images/user.png'; };
  }

  const usernameEl = document.getElementById('ig-display-username');
  if (usernameEl) usernameEl.textContent = '@' + data.username;

  const badge = document.getElementById('ig-privacy-badge');
  if (badge) {
    if (data.isPrivate) {
      badge.textContent = 'PRIVATE';
      badge.style.background = 'rgba(239,68,68,0.2)';
      badge.style.color = '#fca5a5';
      badge.style.border = '1px solid rgba(239,68,68,0.3)';
      document.getElementById('ig-private-warning').style.display = 'block';
    } else {
      badge.textContent = 'PUBLIC';
      badge.style.background = 'rgba(34,197,94,0.2)';
      badge.style.color = '#86efac';
      badge.style.border = '1px solid rgba(34,197,94,0.3)';
      document.getElementById('ig-private-warning').style.display = 'none';
    }
  }

  const linkEl = document.getElementById('ig-profile-link-display');
  if (linkEl) linkEl.value = data.profileLink || '';
}

// Connect button
document.getElementById('btn-ig-connect')?.addEventListener('click', () => {
  showInstagramConnectModal();
});

// Disconnect button
document.getElementById('btn-ig-disconnect')?.addEventListener('click', () => {
  clearConnectedInstagram();
  renderInstagramConnectState();
  showToast("Instagram disconnected", "info");
});

// Copy link button
document.getElementById('btn-ig-copy-link')?.addEventListener('click', () => {
  const link = document.getElementById('ig-profile-link-display')?.value;
  if (link) {
    navigator.clipboard.writeText(link).then(() => showToast("Link copied!", "success"));
  }
});

function showInstagramConnectModal() {
  document.querySelectorAll('.ig-connect-modal').forEach(el => el.remove());

  const overlay = document.createElement('div');
  overlay.className = 'ig-connect-modal';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;
    align-items:center;justify-content:center;z-index:99999;
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  `;

  overlay.innerHTML = `
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:24px;
                padding:28px 22px;text-align:center;max-width:360px;width:92%;
                box-shadow:0 20px 60px rgba(0,0,0,0.5);border:2px solid rgba(225,48,108,0.3);">
      <img src="insta.png" style="width:60px;height:60px;margin-bottom:12px;">
      <h3 style="color:#fff;font-size:20px;font-weight:800;margin-bottom:6px;">Connect Instagram</h3>
      <p style="color:rgba(255,255,255,0.6);font-size:13px;margin-bottom:18px;">Enter your Instagram username to connect</p>
      <input id="ig-connect-input" type="text" placeholder="Enter username (e.g. johndoe)"
             style="width:100%;padding:14px 16px;border-radius:14px;border:1.5px solid rgba(225,48,108,0.3);
                    background:rgba(255,255,255,0.08);color:#fff;font-size:15px;font-weight:600;
                    outline:none;margin-bottom:16px;text-align:center;">
      <button id="ig-connect-confirm" style="
        width:100%;padding:16px;border:none;border-radius:50px;font-size:17px;
        font-weight:800;cursor:pointer;color:#fff;
        background:linear-gradient(135deg,#E1306C,#833AB4);
        box-shadow:0 8px 25px rgba(225,48,108,0.4);
      ">🔍 SEARCH & CONNECT</button>
      <button id="ig-connect-cancel" style="
        width:100%;padding:12px;border:none;border-radius:50px;font-size:14px;
        font-weight:600;cursor:pointer;color:#94a3b8;background:transparent;margin-top:10px;
      ">Cancel</button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById('ig-connect-cancel').addEventListener('click', () => overlay.remove());

  document.getElementById('ig-connect-confirm').addEventListener('click', async () => {
    const input = document.getElementById('ig-connect-input');
    const username = input?.value?.trim().replace(/^@/, '');
    if (!username) return showToast("Please enter a username", "error");

    const btn = document.getElementById('ig-connect-confirm');
    btn.disabled = true;
    btn.textContent = '⏳ Searching...';

    try {
      const resp = await fetch('https://payment-backend-production-0b8d.up.railway.app/instagram-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await resp.json();

      if (!data.success || !data.profile) {
        showToast(data.message || "Account not found", "error");
        btn.disabled = false;
        btn.textContent = '🔍 SEARCH & CONNECT';
        return;
      }

      // Save to localStorage and Firestore
      saveConnectedInstagram(data.profile);

      // Also save to user profile in Firestore
      const user = window.cashTreasureUser;
      if (user) {
        try {
          await updateDoc(doc(db, "users", user.uid), {
            connectedInstagram: {
              username: data.profile.username,
              fullName: data.profile.fullName,
              profileLink: data.profile.profileLink,
              isPrivate: data.profile.isPrivate,
              connectedAt: new Date().toISOString()
            }
          });
        } catch (e) { console.warn("Save IG to Firestore failed:", e); }
      }

      overlay.remove();
      renderInstagramConnectState();
      showToast("✅ Instagram Connected!", "success");

    } catch (err) {
      console.error("IG Connect error:", err);
      showToast("Connection failed. Try again.", "error");
      btn.disabled = false;
      btn.textContent = '🔍 SEARCH & CONNECT';
    }
  });
}

// Auto-fill Instagram fields when connected
window.autoFillInstagram = function(usernameInput, linkInput) {
  const data = loadConnectedInstagram();
  if (!data) return false;
  if (usernameInput) usernameInput.value = '@' + data.username;
  if (linkInput) linkInput.value = data.profileLink || '';
  return true;
};

// Init on load
renderInstagramConnectState();


// Secret Telegram Group - Level 4+ only
document.getElementById('secret-telegram-btn')?.addEventListener('click', async () => {
  const user = window.cashTreasureUser;
  if (!user) return showToast("Please login first", "error");

  try {
    const profile = await getUserProfile(user.uid);
    const level = profile?.level || 1;

    if (level < 4) {
      showToast("Only for PRIME ELITE & MEMBER", "error");
    } else {
      window.open('https://t.me/+YOUR_SECRET_GROUP_LINK', '_blank');
    }
  } catch (err) {
    showToast("Something went wrong", "error");
  }
});