/* Drives the website's statevector field behind the blog. hero_fields.js is
   copied verbatim from openqarp.github.io so the two stay in step. */
(function () {
  "use strict";
  var cv = document.getElementById("field");
  var make = (window.QARP_HERO_FIELDS || {}).statevector;
  if (!cv || !cv.getContext || !make) return;
  var root = document.documentElement;
  if (window.QARP_HERO_THEME) window.QARP_HERO_THEME(root.getAttribute("data-theme") === "dark");
  var field = make(cv), running = false, last = null;
  function still() { return root.classList.contains("still"); }
  function loop(now) {
    if (!running) return;
    var dt = last === null ? 0.016 : Math.min(0.05, (now - last) / 1000);
    last = now;
    field.frame(dt);
    requestAnimationFrame(loop);
  }
  function start() { if (running || still() || document.hidden) return; running = true; last = null; requestAnimationFrame(loop); }
  function stop() { running = false; }
  // chrome.html calls this after the motion or theme switch; still mode keeps one frozen frame
  function sync() { if (still()) { stop(); field.still(); } else start(); }
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  var t = null;
  window.addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () { field.resize(); if (!running) field.still(); }, 150);
  });
  window.QARP_FIELD_SYNC = sync;
  sync();
})();
