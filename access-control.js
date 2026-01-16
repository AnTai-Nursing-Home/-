/* access-control.js (IP 白名單版)
 * 相容 Firebase v8 compat
 *
 * 需求：
 * 1) 院內固定對外 IP 白名單：211.20.249.25
 * 2) 非白名單（院外）模式：只允許部分系統（由各頁自行 guardInsideOnly 或依 mode 決定）
 *
 * 強烈建議：搭配 Cloud Functions 的 getClientAccessMode() 取得「伺服器看到的真實 IP」。
 * 若尚未部署 Functions，本檔案會用 ipify 做「前端 fallback」（較容易被 VPN/代理繞過）。
 */

(function (global) {
  const SESSION_KEY = "antai_session_user";

  // ✅ 你提供的院內對外 IP（可加多筆）
  const ALLOWED_PUBLIC_IPS = ["211.20.249.25"];

  async function getIpByIpify() {
    const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    const data = await res.json();
    return data.ip || "";
  }

  const AccessControl = {
    user: null,
    mode: "outside", // inside | outside
    ip: null,

    async init() {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        alert("未登入");
        location.href = "index.html";
        return;
      }
      this.user = JSON.parse(raw);

      // 1) ✅ 優先用 Cloud Functions（最可靠）
      if (global.firebase && firebase.functions) {
        try {
          const fn = firebase.functions().httpsCallable("getClientAccessMode");
          const res = await fn({ allowedIps: ALLOWED_PUBLIC_IPS });
          this.ip = res.data.ip || null;
          this.mode = res.data.mode || "outside";
          return this.mode;
        } catch (e) {
          console.warn("getClientAccessMode 失敗，改用前端 IP fallback", e);
        }
      }

      // 2) ⚠️ fallback：前端查 IP（較不可靠）
      try {
        const ip = await getIpByIpify();
        this.ip = ip;
        this.mode = ALLOWED_PUBLIC_IPS.includes(ip) ? "inside" : "outside";
      } catch (e) {
        console.warn("前端取得 IP 失敗，預設 outside", e);
        this.mode = "outside";
      }
      return this.mode;
    },

    isInside() {
      return this.mode === "inside";
    },

    // 院內限定頁面：不在白名單就導回
    guardInsideOnly(message) {
      if (!this.isInside()) {
        alert(message || "此系統僅限院內網路使用");
        location.href = "index.html";
      }
    },

    // 依院內/院外切換 UI（你想用時再用）
    // outsideDisableSelectors: [".btn-export", "#btnDelete", ...]
    applyUiPolicy(outsideDisableSelectors) {
      if (this.isInside()) return;
      (outsideDisableSelectors || []).forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          el.disabled = true;
          el.style.opacity = "0.5";
          el.style.pointerEvents = "none";
          el.title = "院外模式不可用";
        });
      });
    }
  };

  global.AccessControl = AccessControl;
})(window);
