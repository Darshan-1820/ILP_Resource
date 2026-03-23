import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { API_URL, PRICE } from "./config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

/* ── Device ID — persistent per browser ── */
function getDeviceId() {
  let id = localStorage.getItem("ilp-device-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ilp-device-id", id);
  }
  return id;
}

/* ── Build the paywall overlay ── */
function createPaywall(isLoggedIn) {
  const wall = document.createElement("div");
  wall.id = "paywall";
  wall.innerHTML = `
    <div class="paywall-card">
      <div class="paywall-lock">🔒</div>
      <h3>Unlock Full Access</h3>
      <p class="paywall-desc">Get complete notes, all practice questions, walkthroughs, and exam tips for every TCS ILP subject.</p>
      <div class="paywall-price">₹${PRICE} <span>one-time</span></div>
      ${isLoggedIn
        ? `<button class="paywall-btn" id="payBtn">Pay ₹${PRICE} & Unlock</button>`
        : `<button class="paywall-btn" onclick="window.location.href=window.location.pathname.includes('/pages/')?'../login.html':'login.html'">Sign Up to Unlock</button>`
      }
      <p class="paywall-note">UPI, Cards, Net Banking accepted</p>
    </div>
  `;
  return wall;
}

/* ── Lock content after N free sections ── */
function lockContent() {
  const container = document.querySelector(".main section") || document.querySelector(".main");
  if (!container) return;

  // Strategy 1: flat h3 (with or without id) — most pages
  let headings = container.querySelectorAll(":scope > h3");

  // Strategy 2: nested <section> children that each contain an h3 (hackerrank-tips)
  if (headings.length === 0) {
    const childSections = container.querySelectorAll(":scope > section");
    if (childSections.length > 2) {
      const cutoff = childSections[2];
      // Hide cutoff section and all following siblings
      let el = cutoff;
      while (el) {
        const next = el.nextElementSibling;
        if (el.tagName !== "SCRIPT") {
          el.style.display = "none";
          el.setAttribute("data-locked", "true");
        }
        el = next;
      }
      cutoff.parentNode.insertBefore(createPaywall(false), cutoff);
      window._paywallReady = true;
    }
    return;
  }

  if (headings.length <= 2) return; // too few sections to lock

  // The 3rd h3 is where we cut off
  const cutoff = headings[2];

  // Walk through ALL siblings starting from the cutoff and hide them
  let el = cutoff;
  while (el) {
    const next = el.nextElementSibling;
    if (el.tagName !== "SCRIPT") {
      el.style.display = "none";
      el.setAttribute("data-locked", "true");
    }
    el = next;
  }

  // Insert paywall before the cutoff
  cutoff.parentNode.insertBefore(createPaywall(false), cutoff);
  window._paywallReady = true;
}

/* ── Unlock content (paid user) ── */
function unlockContent() {
  document.querySelectorAll("[data-locked]").forEach(el => {
    el.style.display = "";
    el.removeAttribute("data-locked");
  });
  const wall = document.getElementById("paywall");
  if (wall) wall.remove();
}

/* ── Razorpay checkout ── */
async function startPayment(user) {
  const token = await user.getIdToken();

  // Create order
  const res = await fetch(`${API_URL}/api/payment/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (data.alreadyPaid) {
    unlockContent();
    return;
  }

  if (!data.orderId) {
    alert(data.error || "Payment service unavailable. Try again later.");
    return;
  }

  // Open Razorpay checkout
  const options = {
    key: data.keyId,
    amount: data.amount,
    currency: data.currency,
    name: "ILP Study Guide",
    description: "Full Access — All Subjects",
    order_id: data.orderId,
    handler: async function (response) {
      // Verify payment
      const verifyRes = await fetch(`${API_URL}/api/payment/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }),
      });

      const result = await verifyRes.json();
      if (result.success) {
        unlockContent();
      } else {
        alert("Payment verification failed. Contact support.");
      }
    },
    prefill: {
      email: user.email,
      name: user.displayName || "",
    },
    theme: {
      color: "#18181b",
    },
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

/* ── Main: paywall disabled — all content free for now ── */
// TODO: Re-enable paywall once Razorpay account is fully activated
// onAuthStateChanged(auth, async (user) => { ... });
