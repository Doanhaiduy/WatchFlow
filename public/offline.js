/* Trang mất kết nối: "Thử lại" tải lại đúng địa chỉ đang xem; tự tải lại khi mạng quay lại. Không gọi dịch vụ ngoài. */
(function () {
  var retry = document.getElementById("retry");
  var hint = document.getElementById("hint");
  if (retry) retry.addEventListener("click", function (e) { e.preventDefault(); location.reload(); });
  window.addEventListener("online", function () {
    if (hint) hint.hidden = false;
    setTimeout(function () { location.reload(); }, 600);
  });
})();
