/* 파일 저장 도우미: Claude 안에서 열면 Claude의 저장 기능을 쓰고,
   GitHub Pages나 파일로 열면 브라우저 기본 다운로드로 저장해요. 각 페이지 <head>에서 가장 먼저 불러요.
   휴대폰(카카오톡·네이버 앱 안 포함)은 다운로드가 잘 안 되거나 "지원하지 않는 형식"이 떠서,
   공유 창(사진·파일에 저장)을 쓰고, 그것도 안 되면 code "unavailable"을 돌려줘요.
   그러면 각 페이지가 그림을 크게 띄워 길게 눌러 저장하게 해요. */
try { if (!window.claude && parent !== window && parent.claude) window.claude = parent.claude; } catch (e) {}
if (!window.claude) {
  var __mob = /Android|iPhone|iPad|iPod|KAKAOTALK|NAVER|Line\//i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  var __bd = {
    save: async function (o) {
      var b = o.data instanceof Blob ? o.data : new Blob([o.data]);
      if (__mob) {
        var ext = (String(o.filename).split(".").pop() || "").toLowerCase();
        var ty = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", pdf: "application/pdf", zip: "application/zip",
          xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }[ext] || b.type || "application/octet-stream";
        var f = null;
        try { f = new File([b], o.filename, { type: ty }); } catch (e) {}
        if (f && navigator.canShare && navigator.canShare({ files: [f] })) {
          try { await navigator.share({ files: [f] }); return { status: "saved" }; }
          catch (e) { if (e && e.name === "AbortError") { var d = new Error("declined"); d.code = "declined"; throw d; } }
        }
        var u2 = new Error("unavailable"); u2.code = "unavailable"; throw u2;
      }
      var u = URL.createObjectURL(b), a = document.createElement("a");
      a.href = u; a.download = o.filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
      return { status: "saved" };
    }
  };
  window.claude = { use: async function (n) { return n === "downloads" ? __bd : null; } };
}
