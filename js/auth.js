import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

/* ── Auth UI: adds a small login/profile button to top-right ── */
function createAuthUI() {
  const btn = document.createElement("button");
  btn.className = "auth-btn";
  btn.style.cssText = `
    position:fixed; top:14px; right:14px; z-index:9999;
    padding:6px 16px; border-radius:6px; font-size:12px;
    font-weight:600; font-family:inherit; cursor:pointer;
    border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.06);
    color:#a1a1aa; transition:all .2s; letter-spacing:.3px;
  `;
  btn.addEventListener("mouseenter", () => {
    btn.style.borderColor = "rgba(255,255,255,.3)";
    btn.style.color = "#fff";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.borderColor = "rgba(255,255,255,.15)";
    btn.style.color = "#a1a1aa";
  });
  document.body.appendChild(btn);
  return btn;
}

const authBtn = createAuthUI();

onAuthStateChanged(auth, (user) => {
  if (user) {
    const name = user.displayName || user.email.split("@")[0];
    authBtn.textContent = name;
    authBtn.title = "Click to sign out";
    authBtn.onclick = async () => {
      await signOut(auth);
      window.location.href = window.location.pathname.includes("/pages/")
        ? "../login.html"
        : "login.html";
    };
  } else {
    authBtn.textContent = "Sign In";
    authBtn.title = "Sign in to track progress";
    authBtn.onclick = () => {
      window.location.href = window.location.pathname.includes("/pages/")
        ? "../login.html"
        : "login.html";
    };
  }
});
