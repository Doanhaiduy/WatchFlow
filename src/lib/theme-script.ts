// Chế độ giao diện: Sáng / Tối / Theo hệ thống. Lưu localStorage `wf-theme` ("light" | "dark" | "system"; thiếu = sáng).
// Đoạn script dưới đây được chèn vào <head> (có CSP nonce) để đặt data-theme TRƯỚC khi vẽ — chống nháy trắng.
export const THEME_KEY = "wf-theme";
export const THEME_COLOR = { light: "#5B5BF0", dark: "#0E1022" } as const;

export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_KEY}");var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?"${THEME_COLOR.dark}":"${THEME_COLOR.light}")}catch(e){}})();`;
