// ================================
// Prime Follower - Level & Membership System
// Complete membership tier system with carousel, progress tracking, and retention
// ================================

// ── 1. Imports ────────────────────────────────────────────────────────────────

import {
  db, auth,
  getUserProfile,
  doc, updateDoc, getDoc,
  increment, Timestamp, serverTimestamp
} from "./firebase.js";

import {
  collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── 2. Level Definitions ──────────────────────────────────────────────────────

const LEVELS = [
  {
    id: 1,
    name: "Prime Starter",
    shortName: "STARTER",
    badge: "icons/plant.png",
    levelBadge: "images/badge1.png",
    badgeGlow: "rgba(34,197,94,0.6)",
    journey: "Your journey has just begun.",
    requirement: "Default level for every new member.",
    retentionReq: "NO REQUIREMENT!",
    benefits: [
      { icon: "🏷️", text: "Monthly 5% Coupon Code" },
      { icon: "📺", text: "Daily Ad Limit: 10" },
      { icon: "⏱️", text: "Order Delivery Time: 24 Hours" }
    ],
    adLimit: 10,
    deliveryHours: 24,
    adMultiplier: 1,
    checkinMultiplier: 1,
    couponPercent: 5,
    creditOrderDiscount: 0,
    freeFollowersMonthly: 0,
    freeFollowersLifetime: 0,
    viralBonusFollowers: 500
  },
  {
    id: 2,
    name: "Prime Lion",
    shortName: "LION",
    badge: "icons/lion.png",
    levelBadge: "images/badge2.png",
    badgeGlow: "rgba(255,215,0,0.6)",
    journey: "You are building consistency and growing stronger every day.",
    requirement: "Complete 7-Day Check-In Challenge.",
    retentionReq: "NO REQUIREMENT!",
    benefits: [
      { icon: "🏷️", text: "Monthly 5% Coupon Code" },
      { icon: "💰", text: "10% Credit Order Discount" },
      { icon: "📺", text: "Daily Ad Limit: 15" },
      { icon: "⚡", text: "Priority Support" },
      { icon: "⏱️", text: "Order Delivery Time: 24 Hours" }
    ],
    adLimit: 15,
    deliveryHours: 24,
    adMultiplier: 1,
    checkinMultiplier: 1,
    couponPercent: 5,
    creditOrderDiscount: 10,
    freeFollowersMonthly: 0,
    freeFollowersLifetime: 0,
    viralBonusFollowers: 500
  },
  {
    id: 3,
    name: "Prime Shark",
    shortName: "SHARK",
    badge: "icons/shark.png",
    levelBadge: "images/badge3.png",
    badgeGlow: "rgba(96,165,250,0.6)",
    journey: "You are making waves and unlocking powerful rewards.",
    requirement: "Complete Prime Viral Bonus OR Any Successful Paid Purchase.",
    retentionReq: "EARN ATLEAST 100 CREDITS IN A MONTH",
    benefits: [
      { icon: "🏷️", text: "Monthly 5% Coupon Code" },
      { icon: "💰", text: "10% Credit Order Discount" },
      { icon: "👥", text: "100 Free Followers (Lifetime)" },
      { icon: "📈", text: "Ad Earnings Multiplier: 1.2x" },
      { icon: "📺", text: "Daily Ad Limit: 20" },
      { icon: "🚀", text: "Prime Viral Bonus: 750 Followers" },
      { icon: "⚡", text: "Priority Support" },
      { icon: "⏱️", text: "Order Delivery Time: 12 Hours" },
      { icon: "🎁", text: "Exclusive Credit Packages" }
    ],
    adLimit: 20,
    deliveryHours: 12,
    adMultiplier: 1.2,
    checkinMultiplier: 1,
    couponPercent: 5,
    creditOrderDiscount: 10,
    freeFollowersMonthly: 0,
    freeFollowersLifetime: 100,
    viralBonusFollowers: 750
  },
  {
    id: 4,
    name: "Prime Elite",
    shortName: "ELITE",
    badge: "icons/diamond.png",
    levelBadge: "images/badge4.png",
    badgeGlow: "rgba(37,99,235,0.6)",
    journey: "You are among our elite members with premium privileges.",
    requirement: "₹1000+ Lifetime Spending.",
    retentionReq: "SPEND ATLEAST ₹500 DURING A CALENDER MONTH",
    benefits: [
      { icon: "🏷️", text: "Monthly 10% Coupon Code" },
      { icon: "💰", text: "Monthly 10% Credit Order Coupon" },
      { icon: "👥", text: "100 Free Followers Every Month" },
      { icon: "💎", text: "Secret PRIME Telegram Group" },
      { icon: "📈", text: "Ad Earnings Multiplier: 1.5x" },
      { icon: "📺", text: "Daily Ad Limit: 35" },
      { icon: "🚀", text: "Prime Viral Bonus: 1000 Followers" },
      { icon: "✨", text: "Check-In Rewards: 1.2x" },
      { icon: "👑", text: "Elite Priority Queue" },
      { icon: "⏱️", text: "Order Delivery Time: 12 Hours" },
      { icon: "🎁", text: "Exclusive Credit Packages" }
    ],
    adLimit: 35,
    deliveryHours: 12,
    adMultiplier: 1.5,
    checkinMultiplier: 1.2,
    couponPercent: 10,
    creditOrderDiscount: 10,
    freeFollowersMonthly: 100,
    freeFollowersLifetime: 100,
    viralBonusFollowers: 1000
  },
  {
    id: 5,
    name: "Prime Member",
    shortName: "MEMBER",
    badge: "icons/member.png",
    levelBadge: "images/badge5.png",
    badgeGlow: "rgba(168,85,247,0.6)",
    journey: "You have reached the highest rank and unlocked VIP status.",
    requirement: "₹2000+ Spending During Current Calendar Month.",
    retentionReq: "SPEND ATLEAST ₹1000 DURING A CALENDER MONTH",
    benefits: [
      { icon: "🏷️", text: "Monthly 15% Coupon Code" },
      { icon: "💰", text: "Monthly 10% Credit Order Coupon" },
      { icon: "👥", text: "250 Free Followers Every Month" },
      { icon: "💎", text: "Secret PRIME Telegram Group" },
      { icon: "📈", text: "Ad Earnings Multiplier: 2x" },
      { icon: "📺", text: "Daily Ad Limit: 50" },
      { icon: "🚀", text: "Prime Viral Bonus: 2000 Followers" },
      { icon: "✨", text: "Check-In Rewards: 1.5x" },
      { icon: "👑", text: "VIP Badge" },
      { icon: "⚡", text: "Top Priority Support" },
      { icon: "⏱️", text: "Order Delivery Time: 10 Hours" },
      { icon: "🎁", text: "Exclusive Credit Packages" },
      { icon: "💸", text: "Exclusive Paid Order Packages" }
    ],
    adLimit: 50,
    deliveryHours: 10,
    adMultiplier: 2,
    checkinMultiplier: 1.5,
    couponPercent: 15,
    creditOrderDiscount: 10,
    freeFollowersMonthly: 250,
    freeFollowersLifetime: 100,
    viralBonusFollowers: 2000
  }
];

// ── 3. Level Calculation Engine ───────────────────────────────────────────────

export function calculateUserLevel(profile) {
  if (!profile) return 1;

  const lifetimeSpending = profile.lifetime_spending || 0;
  const monthlySpending = profile.monthly_spending || 0;
  const checkinDay = profile.checkinDay || 0;
  const checkinCycle = profile.checkinCycle || 0;
  const primeViralCompleted = profile.primeViralBonusClaimed || false;
  const firstPaidOrder = profile.first_paid_order_completed || false;

  if (monthlySpending >= 2000) return 5;
  if (lifetimeSpending >= 1000) return 4;
  if (primeViralCompleted || firstPaidOrder) return 3;
  if (checkinCycle >= 1 || checkinDay >= 7) return 2;
  return 1;
}

export function getLevelDef(levelId) {
  return LEVELS.find(l => l.id === levelId) || LEVELS[0];
}

export function getNextLevel(currentLevel) {
  if (currentLevel >= 5) return null;
  return LEVELS.find(l => l.id === currentLevel + 1);
}

export function getLevelBenefits(levelId) {
  const def = getLevelDef(levelId);
  return {
    adLimit: def.adLimit,
    deliveryHours: def.deliveryHours,
    adMultiplier: def.adMultiplier,
    checkinMultiplier: def.checkinMultiplier,
    couponPercent: def.couponPercent,
    creditOrderDiscount: def.creditOrderDiscount,
    freeFollowersMonthly: def.freeFollowersMonthly,
    freeFollowersLifetime: def.freeFollowersLifetime,
    viralBonusFollowers: def.viralBonusFollowers
  };
}

export function calculateProgress(profile, currentLevel) {
  if (currentLevel >= 5) {
    return { percent: 100, text: "Maximum Level Reached", nextName: null };
  }

  const checkinDay = profile.checkinDay || 0;
  const checkinCycle = profile.checkinCycle || 0;
  const lifetimeSpending = profile.lifetime_spending || 0;
  const monthlySpending = profile.monthly_spending || 0;
  const primeViralCompleted = profile.primeViralBonusClaimed || false;
  const firstPaidOrder = profile.first_paid_order_completed || false;

  switch (currentLevel) {
    case 1: {
      const totalDays = (checkinCycle * 7) + checkinDay;
      const pct = Math.min(Math.round((totalDays / 7) * 100), 100);
      const remaining = Math.max(7 - totalDays, 0);
      return {
        percent: pct,
        text: remaining > 0 ? `Complete ${remaining} more check-in${remaining !== 1 ? 's' : ''}` : "Challenge complete!",
        nextName: "PRIME LION"
      };
    }
    case 2: {
      if (primeViralCompleted || firstPaidOrder) {
        return { percent: 100, text: "Requirement met!", nextName: "PRIME SHARK" };
      }
      return { percent: 25, text: "Complete Prime Viral Bonus or make a paid purchase", nextName: "PRIME SHARK" };
    }
    case 3: {
      const pct = Math.min(Math.round((lifetimeSpending / 1000) * 100), 100);
      const remaining = Math.max(1000 - lifetimeSpending, 0);
      return {
        percent: pct,
        text: remaining > 0 ? `Spend ₹${remaining} more` : "Requirement met!",
        nextName: "PRIME ELITE"
      };
    }
    case 4: {
      const pct = Math.min(Math.round((monthlySpending / 2000) * 100), 100);
      const remaining = Math.max(2000 - monthlySpending, 0);
      return {
        percent: pct,
        text: remaining > 0 ? `Spend ₹${remaining} more this month` : "Requirement met!",
        nextName: "PRIME MEMBER"
      };
    }
    default:
      return { percent: 0, text: "", nextName: null };
  }
}

// ── 4. Monthly Retention Review ───────────────────────────────────────────────

export async function applyMonthlyReview(uid, profile) {
  if (!profile) return { demoted: false };

  const now = new Date();
  const lastReview = profile.level_reviewed_at?.toDate?.() || null;

  if (lastReview) {
    const lastMonth = lastReview.getMonth();
    const lastYear = lastReview.getFullYear();
    if (lastMonth === now.getMonth() && lastYear === now.getFullYear()) {
      return { demoted: false };
    }
  }

  if (now.getDate() > 3) return { demoted: false };

  const currentLevel = profile.level || 1;
  const lastMonthSpending = profile.last_month_spending || 0;
  const lastMonthCredits = profile.monthly_credits_earned || 0;
  let newLevel = currentLevel;

  switch (currentLevel) {
    case 5:
      if (lastMonthSpending >= 1000) newLevel = 5;
      else if (lastMonthSpending >= 500) newLevel = 4;
      else newLevel = 3;
      break;
    case 4:
      if (lastMonthSpending >= 500) newLevel = 4;
      else newLevel = 3;
      break;
    case 3:
      if (lastMonthCredits < 100) newLevel = 2;
      break;
    case 2:
    case 1:
      break;
  }

  const updateData = {
    level_reviewed_at: Timestamp.now(),
    last_month_spending: profile.monthly_spending || 0,
    monthly_spending: 0,
    monthly_credits_earned: 0,
    monthly_free_followers_claimed: false
  };

  if (newLevel !== currentLevel) {
    updateData.level = newLevel;
    updateData.level_updated_at = Timestamp.now();
    // Also update benefits when demoted
    const benefits = getLevelBenefits(newLevel);
    updateData.current_ad_limit = benefits.adLimit;
    updateData.current_ad_multiplier = benefits.adMultiplier;
    updateData.current_checkin_multiplier = benefits.checkinMultiplier;
    updateData.current_delivery_hours = benefits.deliveryHours;
    updateData.vip_badge_enabled = newLevel >= 5;
  }

  try {
    await updateDoc(doc(db, "users", uid), updateData);
  } catch (err) {
    console.error("[Level] Monthly review error:", err);
  }

  return {
    demoted: newLevel < currentLevel,
    oldLevel: currentLevel,
    newLevel
  };
}

export async function grantLevelBenefits(uid, levelId) {
  const benefits = getLevelBenefits(levelId);
  try {
    await updateDoc(doc(db, "users", uid), {
      level: levelId,
      level_updated_at: Timestamp.now(),
      current_ad_limit: benefits.adLimit,
      current_ad_multiplier: benefits.adMultiplier,
      current_checkin_multiplier: benefits.checkinMultiplier,
      current_delivery_hours: benefits.deliveryHours,
      vip_badge_enabled: levelId >= 5
    });
  } catch (err) {
    console.error("[Level] Grant benefits error:", err);
  }
}

export async function evaluateAndUpdateLevel(uid) {
  try {
    const profile = await getUserProfile(uid);
    if (!profile) return { levelChanged: false };

    const currentLevel = profile.level || 1;
    const calculatedLevel = calculateUserLevel(profile);

    if (calculatedLevel !== currentLevel) {
      await grantLevelBenefits(uid, calculatedLevel);
      return {
        levelChanged: true,
        oldLevel: currentLevel,
        newLevel: calculatedLevel,
        levelDef: getLevelDef(calculatedLevel)
      };
    }

    return { levelChanged: false, oldLevel: currentLevel, newLevel: currentLevel, levelDef: getLevelDef(currentLevel) };
  } catch (err) {
    console.error("[Level] Evaluate error:", err);
    return { levelChanged: false };
  }
}

// ── 5. Home Page Level Card ───────────────────────────────────────────────────

export function renderLevelCard(profile) {
  const currentLevel = profile.level || calculateUserLevel(profile);
  const levelDef = getLevelDef(currentLevel);
  const progress = calculateProgress(profile, currentLevel);
  const nextLevel = getNextLevel(currentLevel);

  document.getElementById("level-card")?.remove();

  const card = document.createElement("div");
  card.id = "level-card";
  card.className = "level-card-home";
  card.addEventListener("click", () => openMembershipPage(profile));

  const progressLabel = nextLevel
    ? `Progress To ${nextLevel.name.toUpperCase()}`
    : "Maximum Level Achieved";

  card.innerHTML = `
    <div class="level-particles" id="level-particles"></div>
    <div class="level-shine"></div>
    <div class="level-card-inner">
      <div class="level-badge-section">
        <div class="level-badge-ring level-ring-${currentLevel}" style="position:relative;">
          <img src="${levelDef.badge}" alt="${levelDef.name}" class="level-badge-img">
          <span class="level-badge-number">${levelDef.id}</span>
          <div class="level-badge-overlay" style="
            position:absolute; top:-22px; left:50%; transform:translateX(-50%);
            width:50px; height:50px; z-index:10;
            filter:drop-shadow(0 0 14px ${levelDef.badgeGlow}) drop-shadow(0 0 30px ${levelDef.badgeGlow});
          ">
            <img src="${levelDef.levelBadge}" style="width:100%;height:100%;object-fit:contain;">
          </div>
        </div>
      </div>
      <div class="level-info-section">
        <span class="level-you-are">You Are</span>
        <h3 class="level-name-text">${levelDef.name.toUpperCase()}</h3>
        <p class="level-journey-text">${levelDef.journey}</p>
        <div class="level-progress-section">
          <span class="level-progress-label">${progressLabel}</span>
          <div class="level-progress-track">
            <div class="level-progress-fill" style="width:0%">
              <span class="level-progress-pct">${progress.percent}%</span>
            </div>
          </div>
          <span class="level-progress-desc">${progress.text}</span>
        </div>
      </div>
    </div>
    <div class="level-card-tap-hint">TAP TO VIEW MEMBERSHIP <i class="fas fa-chevron-right"></i></div>
  `;

  const checkinCard = document.getElementById("checkin-card");
  if (checkinCard) {
    checkinCard.parentNode.insertBefore(card, checkinCard);
  }

  requestAnimationFrame(() => {
    setTimeout(() => {
      const fill = card.querySelector(".level-progress-fill");
      if (fill) fill.style.width = progress.percent + "%";
    }, 200);
  });

  spawnLevelParticles();
  startLevelPulse();
}

function spawnLevelParticles() {
  const container = document.getElementById("level-particles");
  if (!container) return;
  container.innerHTML = "";
  for (let i = 0; i < 12; i++) {
    const dot = document.createElement("span");
    dot.className = "level-particle-dot";
    dot.style.left = Math.random() * 100 + "%";
    dot.style.top = Math.random() * 100 + "%";
    dot.style.animationDelay = (Math.random() * 4) + "s";
    dot.style.animationDuration = (3 + Math.random() * 4) + "s";
    container.appendChild(dot);
  }
}

let levelPulseInterval = null;
function startLevelPulse() {
  if (levelPulseInterval) clearInterval(levelPulseInterval);
  levelPulseInterval = setInterval(() => {
    const card = document.getElementById("level-card");
    if (!card) { clearInterval(levelPulseInterval); return; }
    card.classList.add("level-pulse");
    setTimeout(() => card.classList.remove("level-pulse"), 1200);
  }, 5000);
}

// ── 6. Membership Full Page ───────────────────────────────────────────────────

let memberSlideIndex = 0;
let memberAutoTimer = null;
let memberTouchStartX = 0;
let memberIsSwiping = false;

function openMembershipPage(profile) {
  const currentLevel = profile.level || calculateUserLevel(profile);
  document.getElementById("membership-page-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "membership-page-overlay";
  overlay.className = "membership-overlay";

  overlay.innerHTML = `
    <div class="membership-header">
      <button class="membership-back-btn" id="membership-back"><i class="fas fa-arrow-left"></i></button>
      <h3 class="membership-title">PRIME LEVELS</h3>
      <div style="width:36px;"></div>
    </div>
    <div class="membership-dots" id="membership-dots"></div>
    <div class="membership-viewport" id="membership-viewport">
      <div class="membership-track" id="membership-track">
        ${buildAllSlides(profile, currentLevel)}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("visible"));

  buildMemberDots(6);
  goToMemberSlide(0);

  document.getElementById("membership-back").addEventListener("click", closeMembershipPage);

  const viewport = document.getElementById("membership-viewport");
  viewport.addEventListener("touchstart", onMemberTouchStart, { passive: true });
  viewport.addEventListener("touchend", onMemberTouchEnd, { passive: true });

  startMemberAutoplay();
}

function closeMembershipPage() {
  const overlay = document.getElementById("membership-page-overlay");
  if (!overlay) return;
  overlay.classList.remove("visible");
  stopMemberAutoplay();
  setTimeout(() => overlay.remove(), 350);
}

function buildAllSlides(profile, currentLevel) {
  let html = buildIntroSlide();
  for (let i = 0; i < LEVELS.length; i++) {
    html += buildLevelSlide(LEVELS[i], currentLevel, profile);
  }
  return html;
}

function buildIntroSlide() {
  return `
    <div class="membership-slide ms-slide-intro">
      <div class="ms-bg-particles" id="ms-particles-0"></div>
      <div class="membership-slide-scroll">
        <div class="membership-intro-content">
          <div class="membership-crown-wrap">
            <img src="icons/crown.png" alt="Crown" class="membership-crown-img">
          </div>
          <h2 class="membership-intro-heading">PRIME<br>MEMBERSHIP</h2>
          <div class="membership-intro-divider"></div>
          <p class="membership-intro-desc">
            Prime Membership rewards active users with exclusive discounts, free followers,
            premium benefits, faster delivery, higher earnings, and VIP rewards.
          </p>
          <p class="membership-intro-desc" style="margin-top:12px;">
            The more active you become, the more rewards you unlock.
            Reach higher levels and enjoy the full Prime experience.
          </p>
          <div class="ms-info-card ms-info-white">
            <h4 class="ms-info-title">🚀 LEVEL SKIP SYSTEM</h4>
            <p class="ms-info-text">You are <b>NOT</b> required to level up one by one. Prime Follower automatically assigns the <b>highest level</b> you qualify for.</p>
            <div class="ms-info-example">
              <span class="ms-info-ex-label">EXAMPLE 1</span>
              <p>A new user completes Prime Viral Bonus → <b>Immediately becomes Prime Shark</b>. No need to unlock Prime Lion first.</p>
            </div>
            <div class="ms-info-example">
              <span class="ms-info-ex-label">EXAMPLE 2</span>
              <p>A new user spends ₹2500 this month → <b>Immediately becomes Prime Member</b>. Highest level always wins.</p>
            </div>
          </div>
          <div class="ms-info-card ms-info-gold">
            <div class="ms-info-gold-shine"></div>
            <h4 class="ms-info-title" style="color:#1a1000;">⭐ MONTHLY LEVEL REVIEW</h4>
            <p class="ms-info-text" style="color:#3b2800;">At the start of every month, Prime Follower reviews your previous month's activity to keep membership fair.</p>
            <div class="ms-info-example" style="background:rgba(255,255,255,0.5);border-color:rgba(180,130,0,0.2);">
              <span class="ms-info-ex-label" style="color:#8b6914;">EXAMPLE 1</span>
              <p style="color:#3b2800;">Prime Member spent ₹1200 last month → <b>Remains Prime Member</b> ✅</p>
            </div>
            <div class="ms-info-example" style="background:rgba(255,255,255,0.5);border-color:rgba(180,130,0,0.2);">
              <span class="ms-info-ex-label" style="color:#8b6914;">EXAMPLE 2</span>
              <p style="color:#3b2800;">Prime Member spent ₹300 last month → <b>Demoted to Prime Shark</b> ⚠️</p>
            </div>
            <div class="ms-info-example" style="background:rgba(255,255,255,0.5);border-color:rgba(180,130,0,0.2);">
              <span class="ms-info-ex-label" style="color:#8b6914;">EXAMPLE 3</span>
              <p style="color:#3b2800;">Prime Shark earned only 50 credits → <b>Demoted to Prime Lion</b> ⚠️</p>
            </div>
            <p class="ms-info-text" style="color:#5a4000;font-size:12px;margin-top:10px;font-style:italic;">Level maintenance keeps membership fair and rewards active members.</p>
          </div>
          <div class="membership-swipe-hint">
            <span>SWIPE TO EXPLORE LEVELS</span>
            <i class="fas fa-chevron-right"></i>
            <i class="fas fa-chevron-right" style="opacity:0.4;"></i>
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildLevelSlide(levelDef, currentLevel, profile) {
  const isCurrentLevel = levelDef.id === currentLevel;
  const isUnlocked = levelDef.id <= currentLevel;
  const slideThemeClass = `ms-slide-level-${levelDef.id}`;

  let statusBadge = "";
  if (isCurrentLevel) {
    statusBadge = `<span class="membership-status-badge current">YOUR LEVEL</span>`;
  } else if (isUnlocked) {
    statusBadge = `<span class="membership-status-badge unlocked">UNLOCKED</span>`;
  } else {
    statusBadge = `<span class="membership-status-badge locked">LOCKED</span>`;
  }

  const benefitsHTML = levelDef.benefits.map(b => `
    <div class="membership-benefit-item">
      <span class="membership-benefit-icon">${b.icon}</span>
      <span class="membership-benefit-text">${b.text}</span>
    </div>
  `).join("");

  return `
    <div class="membership-slide ${slideThemeClass}">
      <div class="ms-bg-particles" id="ms-particles-${levelDef.id}"></div>
      <div class="membership-slide-scroll">
        <div class="membership-level-content">
          ${statusBadge}
          <div class="membership-level-badge-wrap ms-badge-ring-${levelDef.id} ${isCurrentLevel ? 'active-glow' : ''}" style="position:relative;">
            <img src="${levelDef.badge}" alt="${levelDef.name}" class="membership-level-badge-img">
            <span class="membership-level-badge-num">${levelDef.id}</span>
            <div style="position:absolute; top:-26px; left:50%; transform:translateX(-50%);
                        width:56px; height:56px; z-index:10;
                        filter:drop-shadow(0 0 14px ${levelDef.badgeGlow}) drop-shadow(0 0 28px ${levelDef.badgeGlow});">
              <img src="${levelDef.levelBadge}" style="width:100%;height:100%;object-fit:contain;">
            </div>
          </div>
          <h2 class="membership-level-name">${levelDef.name.toUpperCase()}</h2>
          <p class="membership-level-journey">${levelDef.journey}</p>
          <div class="membership-req-box ms-glass-card">
            <span class="membership-req-label">REQUIREMENT</span>
            <p class="membership-req-text">${levelDef.requirement}</p>
          </div>
          <div class="membership-benefits-box ms-glass-card">
            <span class="membership-benefits-label">BENEFITS</span>
            ${benefitsHTML}
          </div>
          <div class="membership-req-box ms-glass-card" style="margin-top:14px;">
            <span class="membership-req-label">⚠️ REQUIREMENT TO STAY</span>
            <p class="membership-req-text" style="font-weight:800; ${levelDef.retentionReq === 'NO REQUIREMENT!' ? 'color:#86efac;' : 'color:#fbbf24;'}">${levelDef.retentionReq}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── 7. Carousel Navigation ───────────────────────────────────────────────────

function buildMemberDots(count) {
  const dotsEl = document.getElementById("membership-dots");
  if (!dotsEl) return;
  dotsEl.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("button");
    dot.className = "membership-dot" + (i === 0 ? " active" : "");
    dot.addEventListener("click", () => {
      goToMemberSlide(i);
      stopMemberAutoplay();
      restartMemberAutoplayDelayed();
    });
    dotsEl.appendChild(dot);
  }
}

function goToMemberSlide(index) {
  const track = document.getElementById("membership-track");
  const dots = document.querySelectorAll(".membership-dot");
  const slides = document.querySelectorAll(".membership-slide");
  if (!track || !slides.length) return;

  const totalSlides = 6;
  const prevIndex = memberSlideIndex;
  memberSlideIndex = ((index % totalSlides) + totalSlides) % totalSlides;

  slides.forEach((slide, i) => {
    slide.classList.remove("ms-active", "ms-prev", "ms-next");
    if (i === memberSlideIndex) slide.classList.add("ms-active");
    else if (i === prevIndex && prevIndex !== memberSlideIndex) slide.classList.add("ms-prev");
  });

  track.style.transform = `translateX(-${memberSlideIndex * 100}%)`;
  dots.forEach((d, i) => d.classList.toggle("active", i === memberSlideIndex));
  spawnSlideParticles(memberSlideIndex);
}

function nextMemberSlide() { goToMemberSlide(memberSlideIndex + 1); }

function startMemberAutoplay() {
  stopMemberAutoplay();
  const delay = memberSlideIndex === 0 ? 3000 : 5000;
  memberAutoTimer = setTimeout(() => { nextMemberSlide(); startMemberAutoplay(); }, delay);
}

function stopMemberAutoplay() { clearTimeout(memberAutoTimer); memberAutoTimer = null; }
function restartMemberAutoplayDelayed() { setTimeout(startMemberAutoplay, 8000); }

function onMemberTouchStart(e) {
  memberTouchStartX = e.touches[0].clientX;
  memberIsSwiping = true;
  stopMemberAutoplay();
}

function onMemberTouchEnd(e) {
  if (!memberIsSwiping) return;
  memberIsSwiping = false;
  const delta = memberTouchStartX - e.changedTouches[0].clientX;
  if (Math.abs(delta) > 50) {
    if (delta > 0) goToMemberSlide(memberSlideIndex + 1);
    else goToMemberSlide(memberSlideIndex - 1);
  }
  restartMemberAutoplayDelayed();
}

const SLIDE_PARTICLE_COLORS = [
  ["rgba(255,215,0,0.4)", "rgba(255,182,193,0.3)"],
  ["rgba(34,197,94,0.5)", "rgba(16,185,129,0.4)"],
  ["rgba(255,215,0,0.5)", "rgba(245,158,11,0.4)"],
  ["rgba(59,130,246,0.5)", "rgba(96,165,250,0.4)"],
  ["rgba(37,99,235,0.5)", "rgba(79,70,229,0.4)"],
  ["rgba(168,85,247,0.4)", "rgba(255,215,0,0.35)"]
];

function spawnSlideParticles(slideIndex) {
  const container = document.getElementById(`ms-particles-${slideIndex}`);
  if (!container || container.dataset.spawned === "true") return;
  container.dataset.spawned = "true";
  container.innerHTML = "";
  const colors = SLIDE_PARTICLE_COLORS[slideIndex] || SLIDE_PARTICLE_COLORS[0];
  const count = slideIndex === 5 ? 20 : 14;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    dot.className = "ms-particle";
    dot.style.left = (10 + Math.random() * 80) + "%";
    dot.style.bottom = (-5 + Math.random() * 10) + "%";
    dot.style.background = colors[Math.floor(Math.random() * colors.length)];
    dot.style.width = (2 + Math.random() * 3) + "px";
    dot.style.height = dot.style.width;
    dot.style.animationDelay = (Math.random() * 5) + "s";
    dot.style.animationDuration = (4 + Math.random() * 6) + "s";
    container.appendChild(dot);
  }
}

// ── 8. Initialization ─────────────────────────────────────────────────────────

export async function initLevelSystem(uid) {
  try {
    let profile = await getUserProfile(uid);
    if (!profile) return;

    const migrationFields = {};
    if (profile.level === undefined) migrationFields.level = 1;
    if (profile.lifetime_spending === undefined) migrationFields.lifetime_spending = 0;
    if (profile.monthly_spending === undefined) migrationFields.monthly_spending = 0;
    if (profile.last_month_spending === undefined) migrationFields.last_month_spending = 0;
    if (profile.monthly_credits_earned === undefined) migrationFields.monthly_credits_earned = 0;
    if (profile.first_paid_order_completed === undefined) migrationFields.first_paid_order_completed = false;
    if (profile.monthly_free_followers_claimed === undefined) migrationFields.monthly_free_followers_claimed = false;
    if (profile.vip_badge_enabled === undefined) migrationFields.vip_badge_enabled = false;
    if (profile.level_updated_at === undefined) migrationFields.level_updated_at = serverTimestamp();
    if (profile.level_reviewed_at === undefined) migrationFields.level_reviewed_at = null;
    if (profile.current_ad_limit === undefined) migrationFields.current_ad_limit = 10;
    if (profile.current_ad_multiplier === undefined) migrationFields.current_ad_multiplier = 1;
    if (profile.current_checkin_multiplier === undefined) migrationFields.current_checkin_multiplier = 1;
    if (profile.current_delivery_hours === undefined) migrationFields.current_delivery_hours = 24;

    if (Object.keys(migrationFields).length > 0) {
      await updateDoc(doc(db, "users", uid), migrationFields);
      profile = { ...profile, ...migrationFields };
    }

    const reviewResult = await applyMonthlyReview(uid, profile);
    const evalResult = await evaluateAndUpdateLevel(uid);
    profile = await getUserProfile(uid);

    renderLevelCard(profile);

    if (evalResult.levelChanged && evalResult.newLevel > evalResult.oldLevel) {
      showLevelUpNotification(evalResult.levelDef);

      // Award diamond when reaching Level 3 (Shark) — server-controlled
      if (evalResult.newLevel >= 3 && evalResult.oldLevel < 3) {
        try {
          const resp = await fetch('https://payment-backend-production-0b8d.up.railway.app/diamond-shark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid })
          });
          const r = await resp.json();
          if (r.success && !r.already) {
            setTimeout(() => {
              window.showToast?.("💎 Shark Level Diamond Awarded!", "success");
              const diamondEl = document.getElementById("diamond-count");
              if (diamondEl && r.diamonds !== undefined) diamondEl.textContent = r.diamonds;
            }, 2000);
          }
        } catch (e) { console.warn("Shark diamond award failed:", e); }
      }
    }

    if (reviewResult.demoted) {
      const newDef = getLevelDef(reviewResult.newLevel);
      showDemotionNotification(newDef);
    }

  } catch (err) {
    console.error("[Level] Init error:", err);
  }
}

function showLevelUpNotification(levelDef) {
  document.querySelectorAll(".level-up-overlay").forEach(el => el.remove());
  const overlay = document.createElement("div");
  overlay.className = "level-up-overlay";
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.88);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);`;
  overlay.innerHTML = `
    <div class="level-up-card">
      <div class="level-up-sparkles"></div>
      <div style="font-size:50px;margin-bottom:10px;">🎉</div>
      <h2 class="level-up-title">LEVEL UP!</h2>
      <div class="level-up-badge-ring">
        <img src="${levelDef.badge}" alt="${levelDef.name}" class="level-up-badge-img">
      </div>
      <h3 class="level-up-name">${levelDef.name.toUpperCase()}</h3>
      <p class="level-up-journey">${levelDef.journey}</p>
      <button class="level-up-close-btn" id="level-up-close">AWESOME!</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("visible"));
  document.getElementById("level-up-close").addEventListener("click", () => {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.remove(), 350);
  });
}

function showDemotionNotification(newLevelDef) {
  window.showToast?.(`Level adjusted to ${newLevelDef.name}. Stay active to maintain your rank!`, "info");
}

export { LEVELS };

console.log("✅ Level & Membership module loaded.");