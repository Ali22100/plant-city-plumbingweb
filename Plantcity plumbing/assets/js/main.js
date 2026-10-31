/* Waterline — UI behaviour (no libraries). Runs everywhere, including the
   site editor's preview; only toggles states, never rewrites content. */
(function () {
  "use strict";

  // Inside the site editor's preview iframe, never write attributes on load:
  // the editor saves the live DOM, so load-time state would end up in the HTML.
  var framed = window.self !== window.top;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---- Header shadow ---------------------------------- */
  function initHeader() {
    var header = $("[data-header]");
    if (!header) return;
    var update = function () { header.classList.toggle("is-scrolled", window.scrollY > 8); };
    if (!framed) update();
    window.addEventListener("scroll", update, { passive: true });
  }

  /* ---- Desktop dropdowns ------------------------------ */
  function setDropdown(item, open) {
    var button = $(".nav__drop-toggle", item);
    var panel = $(".nav__panel", item);
    if (!button || !panel) return;
    button.setAttribute("aria-expanded", String(open));
    panel.hidden = !open;
  }

  function initDropdowns() {
    var items = $$("[data-dropdown]");
    items.forEach(function (item) {
      var button = $(".nav__drop-toggle", item);
      if (!button) return;
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = button.getAttribute("aria-expanded") !== "true";
        items.forEach(function (other) { if (other !== item) setDropdown(other, false); });
        setDropdown(item, open);
      });
      item.addEventListener("keydown", function (event) {
        if (event.key === "Escape") { setDropdown(item, false); button.focus(); }
      });
      item.addEventListener("focusout", function (event) {
        if (!item.contains(event.relatedTarget)) setDropdown(item, false);
      });
    });
    document.addEventListener("click", function (event) {
      items.forEach(function (item) { if (!item.contains(event.target)) setDropdown(item, false); });
    });
  }

  /* ---- Mobile menu ------------------------------------ */
  function initMenu() {
    var toggle = $(".menu-toggle");
    var menu = $("[data-menu]");
    if (!toggle || !menu) return;
    var label = $(".menu-toggle__label", toggle);
    var dock = $("[data-call-dock]");
    var openLabel = toggle.getAttribute("data-open-label") || "Menu";
    var closeLabel = toggle.getAttribute("data-close-label") || "Close";

    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("is-open", open);
      document.body.classList.toggle("is-menu-open", open);
      // Editor preview saves the live DOM: never swap the label text there (it would save "Close").
      if (label && !framed) label.textContent = open ? closeLabel : openLabel;
      if (dock) dock.classList.toggle("is-hidden", open);
      if (open) { var first = $("a", menu); if (first) first.focus({ preventScroll: true }); }
    };

    toggle.addEventListener("click", function () { setOpen(toggle.getAttribute("aria-expanded") !== "true"); });
    $$("a", menu).forEach(function (link) { link.addEventListener("click", function () { setOpen(false); }); });
    document.addEventListener("keydown", function (event) {
      if (!menu.classList.contains("is-open")) return;
      if (event.key === "Escape") { setOpen(false); toggle.focus(); return; }
      if (event.key !== "Tab") return;
      var items = [toggle].concat($$("a, button", menu));
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    window.matchMedia("(min-width: 981px)").addEventListener("change", function (e) { if (e.matches) setOpen(false); });
  }

  /* ---- Accordion -------------------------------------- */
  function initAccordions() {
    $$("[data-accordion]").forEach(function (acc) {
      var triggers = $$(".accordion__trigger", acc);
      triggers.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var willOpen = btn.getAttribute("aria-expanded") !== "true";
          triggers.forEach(function (other) {
            other.setAttribute("aria-expanded", "false");
            var p = document.getElementById(other.getAttribute("aria-controls"));
            if (p) p.hidden = true;
          });
          if (willOpen) {
            btn.setAttribute("aria-expanded", "true");
            var panel = document.getElementById(btn.getAttribute("aria-controls"));
            if (panel) panel.hidden = false;
          }
          window.dispatchEvent(new CustomEvent("layout:change"));
        });
      });
    });
  }

  /* ---- Tabs ------------------------------------------- */
  function initTabs() {
    $$("[data-tabs]").forEach(function (root) {
      var tabs = $$('[role="tab"]', root);
      var select = function (tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute("aria-selected", String(on));
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(t.getAttribute("aria-controls"));
          if (panel) panel.hidden = !on;
        });
        if (focus) tab.focus();
        window.dispatchEvent(new CustomEvent("layout:change"));
      };
      tabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () { select(tab); });
        tab.addEventListener("keydown", function (e) {
          var n = null;
          if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
          if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
          if (e.key === "Home") n = 0;
          if (e.key === "End") n = tabs.length - 1;
          if (n !== null) { e.preventDefault(); select(tabs[n], true); }
        });
      });
    });
  }

  /* ---- Review carousel (native scroll + buttons) ------ */
  function initCarousels() {
    $$("[data-carousel]").forEach(function (root) {
      var track = $("[data-carousel-track]", root);
      var prev = $("[data-carousel-prev]", root);
      var next = $("[data-carousel-next]", root);
      var status = $("[data-carousel-status]", root);
      if (!track) return;
      var slides = Array.prototype.slice.call(track.children);
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      var step = function () { return slides[1] ? slides[1].offsetLeft - slides[0].offsetLeft : track.clientWidth; };
      var current = function () { return Math.round(track.scrollLeft / step()); };
      var update = function () {
        // Editor preview: a resize/scroll there must not write `disabled` into the saved page.
        if (framed) return;
        var max = track.scrollWidth - track.clientWidth - 2;
        // RTL pages scroll to negative scrollLeft values: compare the distance from the start.
        var pos = Math.abs(track.scrollLeft);
        if (prev) prev.disabled = pos < Math.min(8, Math.abs(step()) / 2);
        if (next) next.disabled = pos >= max;
      };
      var go = function (dir) {
        var target = Math.max(0, Math.min(slides.length - 1, current() + dir));
        track.scrollTo({ left: target * step(), behavior: reduce.matches ? "auto" : "smooth" });
        if (status && !framed) status.textContent = (target + 1) + " / " + slides.length;
      };
      if (prev) prev.addEventListener("click", function () { go(-1); });
      if (next) next.addEventListener("click", function () { go(1); });
      track.addEventListener("scroll", update, { passive: true });
      track.addEventListener("keydown", function (e) {
        var rtl = getComputedStyle(track).direction === "rtl";
        if (e.key === "ArrowRight") { e.preventDefault(); go(rtl ? -1 : 1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(rtl ? 1 : -1); }
      });
      window.addEventListener("resize", update);
      if (!framed) update();
    });
  }

  /* ---- Index list ↔ photo swap ------------------------ */
  function initSwaps() {
    $$("[data-swap]").forEach(function (root) {
      var items = $$("[data-swap-item]", root);
      var imgs = $$("[data-swap-img]", root);
      var set = function (i) {
        items.forEach(function (el, k) { el.classList.toggle("is-active", k === i); });
        imgs.forEach(function (el, k) { el.classList.toggle("is-active", k === i); });
      };
      items.forEach(function (item, i) {
        item.addEventListener("pointerenter", function () { set(i); });
        item.addEventListener("focusin", function () { set(i); });
        item.addEventListener("click", function () { set(i); });
      });
    });
  }

  /* ---- Location links ↔ map pins ---------------------- */
  function initLocations() {
    $$("[data-locations]").forEach(function (root) {
      var pins = $$("[data-pin]", root);
      $$("[data-loc]", root).forEach(function (link) {
        var on = function () { pins.forEach(function (p) { p.classList.toggle("is-active", p.getAttribute("data-pin") === link.getAttribute("data-loc")); }); };
        var off = function () { pins.forEach(function (p) { p.classList.remove("is-active"); }); };
        link.addEventListener("pointerenter", on);
        link.addEventListener("focus", on);
        link.addEventListener("pointerleave", off);
        link.addEventListener("blur", off);
      });
    });
  }

  /* ---- Mobile call dock ------------------------------- */
  function initCallDock() {
    if (framed) return;
    var dock = $("[data-call-dock]");
    var hero = $(".hero, .l-hero, .s-hero, .p-hero, .article-hero");
    if (!dock || !hero || !("IntersectionObserver" in window)) return;
    // Follow the hero's own call button, not the whole hero: on a short phone (320x568, landscape) that button sits
    // below the first screen, so the dock stays up and a call action is always on the first screen; it steps aside
    // only while the hero button itself is visible.
    var heroCta = $(".wl-btn", hero);
    var io = new IntersectionObserver(function (entries) {
      if (document.body.classList.contains("is-menu-open")) return;
      var entry = entries[0];
      dock.classList.toggle("is-hidden", heroCta ? entry.intersectionRatio >= 0.95 : entry.isIntersecting);
    }, { threshold: heroCta ? [0, 0.95] : 0.25 });
    io.observe(heroCta || hero);
  }

  /* ---- Lead forms ------------------------------------- */
  function leadConfig() {
    var config = window.__RL_LEADS || {};
    var base = String(config.apiBase || "");
    var siteId = String(config.siteId || "");
    if (!/^https?:\/\//.test(base) || !siteId || siteId.indexOf("{{") !== -1) return null;
    return { apiBase: base.replace(/\/+$/, ""), siteId: siteId };
  }

  function setFormState(form, state) {
    form.setAttribute("data-status", state);
    var button = $('button[type="submit"]', form);
    var map = { success: ".form-success", error: ".form-error", invalid: ".form-invalid" };
    Object.keys(map).forEach(function (key) {
      var el = $(map[key], form);
      if (el) el.classList.toggle("visible", state === key);
    });
    if (button) {
      button.disabled = state === "pending" || state === "success";
      if (state === "pending") button.setAttribute("aria-busy", "true");
      else button.removeAttribute("aria-busy");
    }
    if (state === "error") { var err = $(".form-error", form); if (err) err.focus({ preventScroll: true }); }
  }

  function validate(form) {
    var firstBad = null;
    $$("input, select, textarea", form).forEach(function (field) {
      if (field.name === "_hp" || field.type === "hidden") return;
      var bad = !field.checkValidity();
      if (field.required || field.value) field.setAttribute("aria-invalid", bad ? "true" : "false");
      if (bad && !firstBad) firstBad = field;
    });
    return firstBad;
  }

  function initLeadForms() {
    $$("form[data-rl-lead]").forEach(function (form) {
      $$("input, select, textarea", form).forEach(function (field) {
        field.addEventListener("input", function () {
          if (field.getAttribute("aria-invalid") === "true" && field.checkValidity()) field.setAttribute("aria-invalid", "false");
        });
      });
    });
    document.addEventListener("submit", function (event) {
      var form = event.target && event.target.matches && event.target.matches("form[data-rl-lead]") ? event.target : null;
      if (!form) return;
      event.preventDefault();
      // Editor preview: no validation state (data-status, aria-invalid) and no lead is ever sent.
      if (framed) return;
      var status = form.getAttribute("data-status");
      if (status === "pending" || status === "success") return;
      var bad = validate(form);
      if (bad) { setFormState(form, "invalid"); bad.focus(); return; }
      var honeypot = $('[name="_hp"]', form);
      if (honeypot && honeypot.value) { setFormState(form, "success"); return; }
      var config = leadConfig();
      if (!config) { setFormState(form, "error"); return; }
      var payload = {};
      new FormData(form).forEach(function (value, key) {
        if (key !== "_hp" && key !== "cf-turnstile-response") payload[key] = String(value);
        if (key === "cf-turnstile-response" && value) payload.turnstileToken = String(value);
      });
      payload.pageUrl = window.location.href;
      setFormState(form, "pending");
      fetch(config.apiBase + "/api/leads/" + encodeURIComponent(config.siteId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).then(function (response) {
        if (!response.ok) throw new Error("Lead request failed");
        setFormState(form, "success");
        form.reset();
      }).catch(function () {
        setFormState(form, "error");
      });
    });
    document.addEventListener("rl:lead-success", function (e) { if (e.detail && e.detail.form) setFormState(e.detail.form, "success"); });
    document.addEventListener("rl:lead-error", function (e) { if (e.detail && e.detail.form) setFormState(e.detail.form, "error"); });
  }

  /* ---- Current page in nav ---------------------------- */
  function markCurrent() {
    if (framed) return;
    var here = window.location.pathname.replace(/\/index(\.html)?$/, "/").replace(/\.html$/, "").replace(/\/+$/, "") || "/";
    $$(".nav__link, .menu__link").forEach(function (link) {
      var href = link.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") return;
      var path;
      try { path = new URL(href, window.location.href).pathname; } catch (_e) { return; }
      path = path.replace(/\/index(\.html)?$/, "/").replace(/\.html$/, "").replace(/\/+$/, "") || "/";
      if (path === here) link.setAttribute("aria-current", "page");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initDropdowns();
    initMenu();
    initAccordions();
    initTabs();
    initCarousels();
    initSwaps();
    initLocations();
    initCallDock();
    initLeadForms();
    markCurrent();
  });

  /* ---- Motion libraries (loaded after first paint) ---- */
  // GSAP, ScrollTrigger, SplitText and motion.js are NOT script tags in the page: a top-level window with
  // motion allowed (the head gate's `wl-motion` class) loads them from here once the first frame is on
  // screen, so ~75 KB of script never competes with the hero photo. They keep their order (async = false).
  // The editor iframe (framed) and reduced-motion visitors never load them; the CSS fail-safes reveal
  // everything on their own if the files never arrive.
  var MOTION_FILES = ["vendor/gsap.min.js", "vendor/ScrollTrigger.min.js", "vendor/SplitText.min.js", "motion.js"];
  var mainScript = document.currentScript || document.querySelector('script[src$="js/main.js"]');
  var motionStarted = false;
  function loadMotion() {
    if (motionStarted) return;
    motionStarted = true;
    if (framed || window.gsap || !document.documentElement.classList.contains("wl-motion")) return;
    var src = mainScript && mainScript.getAttribute("src");
    if (!src) return;
    MOTION_FILES.forEach(function (file) {
      var script = document.createElement("script");
      script.src = src.replace(/main\.js(\?.*)?$/, file);
      script.async = false;
      document.body.appendChild(script);
    });
  }
  if (!framed) {
    window.requestAnimationFrame(function () { window.setTimeout(loadMotion, 0); });
    window.setTimeout(loadMotion, 300); // a hidden tab paints no frames
  }
})();
