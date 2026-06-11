// ================================
// Prime Follower - Daily Check-in System
// ================================

// ── 1. Imports ────────────────────────────────────────────────────────────────

import { getUserProfile, claimDailyCheckin } from "./firebase.js";
import { onCheckinComplete } from "./refer.js";
import {
  db,
  doc,
  updateDoc,
  increment,
  addDoc,
  collection,
  Timestamp,
  serverTimestamp
} from "./firebase.js";

// ── 2. Constants & Reward Mapping ─────────────────────────────────────────────

const DAY_REWARDS = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 0, 6: 1, 7: 0 };
const ADS_REQUIRED = { 4: 5, 7: 10 };

let isClaiming = false;

// ── 3. Helper Functions ───────────────────────────────────────────────────────

function getTodayAds(profile) {
  const today = new Date().toISOString().split("T")[0];
  const adsDate = profile.daily_ads_date
    ? profile.daily_ads_date.toDate().toISOString().split("T")[0]
    : null;
  return adsDate === today ? (profile.daily_ads_watched || 0) : 0;
}

function isClaimedToday(profile) {
  if (!profile?.lastCheckinDate?.toDate) return false;
  try {
    const last = profile.lastCheckinDate.toDate().toISOString().split("T")[0];
    return last === new Date().toISOString().split("T")[0];
  } catch {
    return false;
  }
}

function getNextDay(profile) {
  const next = (profile.checkinDay || 0) + 1;
  return next > 7 ? 1 : next;
}

function isDayUnlocked(day, adsWatched) {
  const required = ADS_REQUIRED[day];
  return required === undefined || adsWatched >= required;
}

// ── 4. Render Functions ───────────────────────────────────────────────────────

export function renderCheckin(profile) {
  const claimed = isClaimedToday(profile);
  const currentDay = profile.checkinDay || 0;
  const nextDay = getNextDay(profile);
  const adsToday = getTodayAds(profile);

  document.querySelectorAll(".checkin-day").forEach(el => {
    const day = Number(el.dataset.day);
    const circle = el.querySelector(".day-circle");
    const rewardEl = el.querySelector(".day-reward");

    el.classList.remove("completed", "current", "locked");

    if (claimed) {
      if (day <= currentDay) {
        el.classList.add("completed");
        circle.textContent = "✓";
        if (day === 3) {
          rewardEl.textContent = "🎁50";   // Still show visual
        } else if (day === 7) {
          rewardEl.textContent = "💎";
        } else {
          rewardEl.textContent = DAY_REWARDS[day] ? `+${DAY_REWARDS[day]}` : "+0";
        }
      } else {
        el.classList.add("locked");
        circle.textContent = "🔒";
        rewardEl.textContent = "+?";
      }
      return;
    }

    if (day < nextDay) {
      el.classList.add("completed");
      circle.textContent = "✓";
      if (day === 3) rewardEl.textContent = "🎁50";
      else if (day === 7) rewardEl.textContent = "💎";
      else rewardEl.textContent = DAY_REWARDS[day] ? `+${DAY_REWARDS[day]}` : "+0";
      return;
    }

    if (day === nextDay) {
      if (!isDayUnlocked(day, adsToday)) {
        el.classList.add("locked");
        circle.textContent = "🔒";
        rewardEl.textContent = "+?";
        return;
      }
      el.classList.add("current");
      if (day === 3) {
        circle.textContent = "🎁";
        rewardEl.textContent = "Refer Code";
      } else if (day === 7) {
        circle.textContent = "💎";
        rewardEl.textContent = "Diamond";
      } else {
        circle.textContent = "";
        rewardEl.textContent = "+?";
      }
      return;
    }

    el.classList.add("locked");
    circle.textContent = "🔒";
    rewardEl.textContent = "+?";
  });

  const btn = document.getElementById("btn-checkin");
  if (btn) {
    if (claimed) {
      btn.disabled = false;
      btn.innerHTML = "✅ Claimed!";
      btn.classList.add("claimed");
    } else {
      btn.disabled = false;
      btn.innerHTML = "🎁 CLAIM";
      btn.classList.remove("claimed");
    }
  }

  updateAdProgress(profile, nextDay);
}

export function updateAdProgress(profile, nextDay) {
  const container = document.querySelector(".ad-progress-container");
  const fill = document.getElementById("ad-progress-fill");
  const text = document.getElementById("ad-progress-text");
  if (!container || !fill || !text) return;

  const required = ADS_REQUIRED[nextDay] || 0;

  if (required === 0) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";
  const ads = getTodayAds(profile);
  fill.style.width = `${Math.min((ads / required) * 100, 100)}%`;
  text.textContent = `${ads}/${required} ads`;
}

// ── 5. Day 3 Referral Reward Overlay (50 Free Followers) ─────────────────────

function showDay3ReferralRewardOverlay(uid) {
  document.querySelectorAll('.day3-reward-overlay').forEach(el => el.remove());

  const overlay = document.createElement("div");
  overlay.className = "day3-reward-overlay";
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.85); display:flex;
    align-items:center; justify-content:center; z-index:99999;
    backdrop-filter:blur(14px);
  `;

  overlay.innerHTML = `
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b); border-radius:24px;
                padding:32px 24px; text-align:center; max-width:360px; width:92%;
                box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div style="font-size:55px; margin-bottom:10px;">🎉</div>
      <h2 style="color:#22c55e; font-size:22px; font-weight:900;">YOU WON 50 FREE FOLLOWERS!</h2>
      <p style="color:#e2e8f0; margin:12px 0;">Thanks to your friend's referral code</p>
      <button id="day3-refer-claim-btn" style="width:100%;padding:16px;border:none;border-radius:50px;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:800;font-size:17px;cursor:pointer;">CLAIM 50 FOLLOWERS</button>
    </div>`;

  document.body.appendChild(overlay);

  document.getElementById("day3-refer-claim-btn").addEventListener("click", () => {
    overlay.remove();
    showDay3InstagramForm(uid);
  });
}

function showDay3InstagramForm(uid) {
  // (Keep this function - it's reused)
  document.querySelectorAll('.day3-ig-overlay').forEach(el => el.remove());

  const overlay = document.createElement("div");
  overlay.className = "day3-ig-overlay";
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.85); display:flex;
    align-items:center; justify-content:center; z-index:99999;
    backdrop-filter:blur(14px);
  `;

  overlay.innerHTML = `
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b); border-radius:24px;
                padding:28px 20px; text-align:center; max-width:360px; width:92%;
                box-shadow:0 20px 60px rgba(0,0,0,0.5); border:2px solid rgba(79,172,254,0.3);">
      <img src="insta.jpeg" style="width:70px; height:70px; border-radius:16px; margin-bottom:14px;">
      <h3 style="color:#fff; font-size:20px; font-weight:800; margin-bottom:16px;">
        Enter Instagram Details
      </h3>
      <input id="day3-ig-username" type="text" placeholder="Instagram Username (e.g. @yourname)"
             style="width:100%; padding:14px 16px; border-radius:14px; border:1.5px solid rgba(79,172,254,0.3);
                    background:rgba(255,255,255,0.08); color:#fff; font-size:14px; margin-bottom:12px; outline:none;">
      <input id="day3-ig-link" type="url" placeholder="Instagram Profile Link"
             style="width:100%; padding:14px 16px; border-radius:14px; border:1.5px solid rgba(79,172,254,0.3);
                    background:rgba(255,255,255,0.08); color:#fff; font-size:14px; margin-bottom:18px; outline:none;">
      <button id="day3-confirm-btn" style="width:100%; padding:16px; border:none; border-radius:50px; font-size:17px;
        font-weight:800; cursor:pointer; color:#fff; background:linear-gradient(135deg,#22c55e,#16a34a); box-shadow:0 8px 25px rgba(34,197,94,0.4);">CONFIRM</button>
      <button id="day3-cancel-btn" style="width:100%; padding:12px; border:none; border-radius:50px; font-size:14px;
        font-weight:600; cursor:pointer; color:#94a3b8; background:transparent; margin-top:10px;">Cancel</button>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("day3-cancel-btn").addEventListener("click", () => overlay.remove());

  document.getElementById("day3-confirm-btn").addEventListener("click", async () => {
    const username = document.getElementById("day3-ig-username")?.value?.trim();
    const link = document.getElementById("day3-ig-link")?.value?.trim();

    if (!username) return window.showToast?.("Please enter username", "error");
    if (link && !link.startsWith("https://www.instagram.com")) {
      return window.showToast?.("Invalid link", "error");
    }

    const btn = document.getElementById("day3-confirm-btn");
    btn.disabled = true;
    btn.textContent = "⏳ Processing...";

    try {
      await addDoc(collection(db, "orders"), {
        user_id: uid,
        instagram_username: username,
        instagram_link: link || "",
        followers: 50,
        credits_spent: 0,
        order_time: Timestamp.now(),
        completion_time: Timestamp.fromDate(new Date(Date.now() + 24*60*60*1000)),
        status: "processing",
        isPaidOrder: false,
        isDay3Bonus: true
      });

      try {
        const { logTransaction } = await import("./firebase.js");
        await logTransaction(uid, "Day 3 Referral Bonus - 50 Free Followers", 0);
      } catch (e) { console.warn(e); }

      try {
        await updateDoc(doc(db, "users", uid), { day3BonusClaimed: true });
      } catch (e) { console.warn(e); }

      overlay.remove();
      window.showToast?.("50 Free Followers order placed! 🎉", "success");

    } catch (err) {
      console.error("[Day3] Order error:", err);
      btn.disabled = false;
      btn.textContent = "CONFIRM";
      window.showToast?.("Something went wrong", "error");
    }
  });
}

// ── 6. Diamond Grand Prize (Day 7) ───────────────────────────────────────────

function showDiamondGrandPrize(uid) {
  // ... (keep your existing Day 7 function - no change needed)
  // [Your existing showDiamondGrandPrize code here]
}

// ── 7. Event Listeners & Claim Logic ─────────────────────────────────────────

window.addEventListener("userReady", async (e) => {
  const profile = await getUserProfile(e.detail.uid);
  if (profile) renderCheckin(profile);
});

document.addEventListener("click", async (e) => {
  if (!e.target.closest("#btn-checkin")) return;
  if (isClaiming) return;

  const user = window.cashTreasureUser;
  if (!user) return window.showToast?.("Login required", "error");

  isClaiming = true;
  const btn = document.getElementById("btn-checkin");
  btn.disabled = true;
  btn.innerHTML = "Loading...";

  try {
    window.pendingRewardType = "daily_checkin";
    window.pendingCheckinUser = user;

    if (window.Android?.showAd) {
      Android.showAd();
    } else {
      window.showToast?.("Ads not available", "error");
      btn.disabled = false;
      btn.innerHTML = "🎁 CLAIM";
      isClaiming = false;
    }
  } catch (err) {
    console.error("[Check-in] Claim error:", err);
    window.showToast?.("Something went wrong", "error");
    btn.disabled = false;
    btn.innerHTML = "🎁 CLAIM";
    isClaiming = false;
  }
});

window.onDailyCheckinRewarded = async function () {
  const user = window.pendingCheckinUser;
  if (!user) return;

  const btn = document.getElementById("btn-checkin");

  try {
    let result;
    try {
      const resp = await fetch('https://payment-backend-production-0b8d.up.railway.app/daily-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      result = await resp.json();
    } catch (e) {
      result = { success: false, message: "Network error" };
    }

    if (!result.success) {
      window.showToast?.(result.message, "error");
      btn.innerHTML = "🎁 CLAIM";
      btn.disabled = false;
      isClaiming = false;
      window.pendingCheckinUser = null;
      return;
    }

    const profile = await getUserProfile(user.uid);
    renderCheckin(profile);

    if (window.cashTreasureUser) window.cashTreasureUser.credits = profile.credits;

    const creditEl = document.getElementById("credit-count");
    if (creditEl) creditEl.textContent = profile.credits;

    // Day 7 Diamond
    if (result.day === 7 && result.isGift) {
      showDiamondGrandPrize(user.uid);
    }
    // Oops Day
    else if (result.isOops) {
      window.showToast?.("😅 Oops Day! No Credit Today");
    }
    // Normal reward
    else if (result.reward > 0) {
      window.showToast?.(`+${result.reward} Credits Added 🎉`);
    }

  } catch (err) {
    console.error("[Check-in] Reward error:", err);
    window.showToast?.("Something went wrong", "error");
  } finally {
    isClaiming = false;
    window.pendingCheckinUser = null;
  }
};

console.log("✅ Daily Check-in module loaded.");