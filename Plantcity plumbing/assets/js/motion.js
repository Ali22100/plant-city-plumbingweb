/* =========================================================
   Waterline (theme-13) — motion layer (GSAP 3 + ScrollTrigger + SplitText)

   Rules this file follows:
   - Nothing is hidden by CSS. Every start state is set here, so if
     GSAP fails to load, the page simply shows everything.
   - All effects live inside gsap.matchMedia() and are reverted
     automatically when their media condition stops matching
     (resize, orientation, reduced-motion toggled).
   - Sticky / stacked sequences use CSS sticky inside an explicitly
     sized parent, so they can never leave their own section.
   - Blur is only used while something moves; it always settles at 0.
   ========================================================= */
(function () {
  "use strict";

  const root = document.documentElement;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const SplitText = window.SplitText;

  // The inline head gate adds `wl-motion` only for a top-level window with
  // motion allowed — never in the site editor's preview iframe.
  if (!root.classList.contains("wl-motion")) return;
  if (!gsap || !ScrollTrigger) {
    root.classList.add("motion-off");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  if (SplitText) gsap.registerPlugin(SplitText);
  root.classList.add("motion-ready");

  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const headerOffset = () => parseFloat(getComputedStyle(root).getPropertyValue("--header-h")) || 76;
  const EASE = "power3.out";

  const mm = gsap.matchMedia();

  /* ---------------------------------------------------------
     Any motion allowed
     --------------------------------------------------------- */
  mm.add("(prefers-reduced-motion: no-preference)", (context) => {
    /* Text splitting is the costliest start-up work (SplitText measures every line), so a heading / statement
       is split only when it comes within half a screen of the viewport, not all at once on load. The work
       is added to this matchMedia context, so it is still reverted when the media query stops matching. */
    const splitQueue = new Map();
    const nearViewport = "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          nearViewport.unobserve(entry.target);
          const run = splitQueue.get(entry.target);
          splitQueue.delete(entry.target);
          if (run) context.add(run);
        });
      }, { rootMargin: "0px 0px 50% 0px" })
      : null;
    const whenNear = (el, run) => {
      if (!nearViewport) { run(); return; }
      splitQueue.set(el, run);
      nearViewport.observe(el);
    };

    /* Hero: water drains away, photo comes into focus */
    const water = document.querySelector("[data-hero-water]");
    const heroMedia = document.querySelector("[data-hero-media]");
    if (heroMedia) {
      const img = heroMedia.querySelector("img");
      const intro = gsap.timeline({ defaults: { ease: "power2.inOut" } });
      if (water) {
        intro.set(water, { opacity: 1, yPercent: 0 });
        intro.to(water, { yPercent: 104, duration: 1.5 }, 0.15);
      }
      if (img) {
        intro.fromTo(img, { scale: 1.14, filter: "blur(14px)" }, { scale: 1.04, filter: "blur(0px)", duration: 1.7, ease: "power2.out", clearProps: "filter" }, 0.1);
        // Drift within the frame while the hero scrolls away (stays inside the rounded mask)
        gsap.fromTo(img, { yPercent: 0 }, {
          yPercent: 7,
          ease: "none",
          scrollTrigger: { trigger: heroMedia, start: "top top", end: "bottom top", scrub: true },
        });
      }
      const note = document.querySelector(".hero__note");
      if (note && getComputedStyle(note).position === "absolute") {
        intro.from(note, { x: 32, autoAlpha: 0, filter: "blur(8px)", duration: 1, ease: EASE, clearProps: "filter" }, 0.9);
      }
    }

    /* Location hero: photo rises into view like a water line, sharpening as it settles */
    document.querySelectorAll("[data-rise-reveal]").forEach((wrap) => {
      const frame = wrap.querySelector(".frame");
      const img = frame && frame.querySelector("img");
      const chip = wrap.querySelector(".l-hero__chip");
      if (!frame) return;
      const r = getComputedStyle(frame).borderRadius || "40px";
      const tl = gsap.timeline({ delay: 0.1 });
      tl.fromTo(frame, { clipPath: `inset(100% 0% 0% 0% round ${r})` }, { clipPath: `inset(0% 0% 0% 0% round ${r})`, duration: 1.4, ease: "power3.inOut" });
      if (img) tl.fromTo(img, { scale: 1.2, filter: "blur(14px)" }, { scale: 1, filter: "blur(0px)", duration: 1.6, ease: "power2.out", clearProps: "filter" }, 0.15);
      if (chip) tl.from(chip, { y: 24, autoAlpha: 0, duration: 0.8, ease: EASE }, 1.0);
      if (img) {
        gsap.fromTo(img, { yPercent: 0 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: frame, start: "top top", end: "bottom top", scrub: true } });
      }
    });

    /* Service hero: wide photo scales up into its frame */
    $$("[data-scale-reveal]").forEach((frame) => {
      gsap.fromTo(frame, { scale: 0.88, borderRadius: "64px" }, {
        scale: 1,
        borderRadius: "40px",
        ease: "none",
        scrollTrigger: { trigger: frame, start: "top 85%", end: "top 25%", scrub: 0.6 },
      });
      const img = frame.querySelector("img");
      if (img) {
        gsap.fromTo(img, { scale: 1.18 }, { scale: 1, ease: "none", scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: true } });
      }
    });

    /* Section headings: restrained line reveal */
    if (SplitText) {
      $$('[data-reveal="lines"]').forEach((el) => whenNear(el, () => {
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.lines, {
              yPercent: 105,
              duration: 1,
              stagger: 0.08,
              ease: "power4.out",
              scrollTrigger: { trigger: el, start: "top 88%", once: true },
            });
          },
        });
      }));

      /* Statement paragraph: words brighten as you read */
      $$("[data-highlight]").forEach((el) => whenNear(el, () => {
        SplitText.create(el, {
          type: "words",
          wordsClass: "word",
          aria: "none", // a <p> may not carry aria-label; plain word spans read naturally
          autoSplit: true,
          onSplit(self) {
            return gsap.fromTo(self.words, { color: "#7d8a91" }, {
              color: "#0d1418",
              stagger: 0.1,
              ease: "none",
              scrollTrigger: { trigger: el, start: "top 78%", end: "bottom 45%", scrub: true },
            });
          },
        });
      }));
    }

    /* Layered parallax, bounded to a few percent */
    $$("[data-parallax]").forEach((el) => {
      const amount = parseFloat(el.dataset.parallax) || 6;
      gsap.fromTo(el, { yPercent: -amount }, {
        yPercent: amount,
        ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
      });
    });

    /* Bento + card groups: settle in as a batch */
    const batchTargets = $$(".bento__tile, [data-batch] > *");
    if (batchTargets.length) {
      gsap.set(batchTargets, { autoAlpha: 0, y: 48 });
      ScrollTrigger.batch(batchTargets, {
        start: "top 90%",
        once: true,
        onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.08, ease: EASE, overwrite: true }),
      });
    }

    /* Estimate lines and other lists that type themselves in */
    $$("[data-stagger]").forEach((list) => {
      gsap.from(list.children, {
        x: 28,
        autoAlpha: 0,
        filter: "blur(6px)",
        duration: 0.8,
        stagger: 0.07,
        ease: EASE,
        clearProps: "filter",
        scrollTrigger: { trigger: list, start: "top 82%", once: true },
      });
    });

    /* Wide image reveal: mask opens, brief blur while it moves */
    $$("[data-wide-reveal]").forEach((frame) => {
      const img = frame.querySelector("img");
      const tl = gsap.timeline({
        scrollTrigger: { trigger: frame, start: "top 95%", end: "center 55%", scrub: 0.5 },
      });
      tl.fromTo(frame, { clipPath: "inset(10% 18% 10% 18% round 72px)" }, { clipPath: "inset(0% 0% 0% 0% round 40px)", ease: "none" }, 0);
      if (img) tl.fromTo(img, { scale: 1.22, filter: "blur(6px)" }, { scale: 1, filter: "blur(0px)", ease: "none" }, 0);
    });

    /* Gooey water beads: drift with scroll, one follows the pointer */
    $$("[data-goo]").forEach((panel) => {
      const beads = $$(".cta__bead", panel).filter((b) => !b.hasAttribute("data-goo-pointer"));
      beads.forEach((bead, i) => {
        gsap.fromTo(bead, { yPercent: -50 + (i % 2 ? 40 : -30), xPercent: -50 + (i % 2 ? -20 : 25) }, {
          yPercent: -50,
          xPercent: -50,
          ease: "none",
          scrollTrigger: { trigger: panel, start: "top bottom", end: "center center", scrub: 1 },
        });
      });
      const follower = panel.querySelector("[data-goo-pointer]");
      if (follower && window.matchMedia("(hover: hover)").matches) {
        const xTo = gsap.quickTo(follower, "x", { duration: 0.9, ease: "power3" });
        const yTo = gsap.quickTo(follower, "y", { duration: 0.9, ease: "power3" });
        const move = (e) => {
          const r = panel.getBoundingClientRect();
          const bx = r.width * (parseFloat(getComputedStyle(follower).left) / r.width);
          const by = r.height * (parseFloat(getComputedStyle(follower).top) / r.height);
          // Clamp so the bead stays in the decorative right half
          xTo(gsap.utils.clamp(-r.width * 0.25, r.width * 0.2, e.clientX - r.left - bx));
          yTo(gsap.utils.clamp(-r.height * 0.35, r.height * 0.35, e.clientY - r.top - by));
        };
        const reset = () => { xTo(0); yTo(0); };
        panel.addEventListener("pointermove", move);
        panel.addEventListener("pointerleave", reset);
        return () => {
          panel.removeEventListener("pointermove", move);
          panel.removeEventListener("pointerleave", reset);
        };
      }
    });

    /* Footer wordmark rises into place */
    $$(".site-footer__wordmark").forEach((mark) => {
      gsap.fromTo(mark, { yPercent: 35 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: mark, start: "top bottom", end: "bottom bottom", scrub: true } });
    });

    return () => {
      if (nearViewport) nearViewport.disconnect();
      splitQueue.clear();
    };
  });

  /* ---------------------------------------------------------
     Large screens with room for sticky sequences
     --------------------------------------------------------- */
  mm.add("(prefers-reduced-motion: no-preference) and (min-width: 900px) and (min-height: 700px)", () => {
    /* Stacked service panels: covered cards recede, incoming photos sharpen */
    $$("[data-stack]").forEach((stack) => {
      const items = $$(".stack__item", stack);
      items.forEach((item, i) => {
        const card = item.querySelector(".svc-card");
        const media = item.querySelector(".svc-card__media img");
        if (media) {
          gsap.fromTo(media, { scale: 1.12, filter: "blur(10px)" }, {
            scale: 1,
            filter: "blur(0px)",
            ease: "none",
            scrollTrigger: { trigger: item, start: "top bottom", end: "top 45%", scrub: true },
          });
        }
        const next = items[i + 1];
        if (!next || !card) return;
        gsap.to(card, {
          scale: 0.94,
          "--dim": 0.16,
          ease: "none",
          scrollTrigger: {
            trigger: next,
            start: "top bottom",
            end: () => "top " + (headerOffset() + 16 + (i + 1) * 14) + "px",
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
      });
    });
  });

  /* Process sequence needs width AND height */
  mm.add("(prefers-reduced-motion: no-preference) and (min-width: 900px) and (min-height: 640px)", () => {
    const cleanups = [];
    $$("[data-process]").forEach((section) => {
      const steps = $$("[data-process-step]", section);
      const imgs = $$("[data-process-img]", section);
      const fill = section.querySelector("[data-dryline]");
      if (!steps.length || !imgs.length) return;

      section.classList.add("is-enhanced");
      let active = -1;

      const show = (index, instant) => {
        if (index === active) return;
        const prev = imgs[active];
        const next = imgs[index];
        steps.forEach((s, k) => s.classList.toggle("is-active", k === index));
        active = index;
        if (!next) return;
        imgs.forEach((im) => im.classList.remove("is-active"));
        next.classList.add("is-active");
        if (instant) {
          gsap.set(imgs, { autoAlpha: 0 });
          gsap.set(next, { autoAlpha: 1 });
          return;
        }
        if (prev) gsap.to(prev, { autoAlpha: 0, scale: 1.06, filter: "blur(16px)", duration: 0.7, ease: "power2.in", overwrite: true });
        gsap.fromTo(next, { autoAlpha: 0, scale: 1.1, filter: "blur(18px)" }, {
          autoAlpha: 1, scale: 1, filter: "blur(0px)", duration: 0.9, ease: "power3.out", overwrite: true, clearProps: "filter,scale",
        });
      };

      gsap.set(imgs, { autoAlpha: 0 });
      show(0, true);

      steps.forEach((step, i) => {
        ScrollTrigger.create({
          trigger: step,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => self.isActive && show(i),
        });
      });

      if (fill) {
        gsap.fromTo(fill, { scaleX: 0 }, {
          scaleX: 1,
          ease: "none",
          scrollTrigger: { trigger: steps[0].parentElement, start: "top 55%", end: "bottom 55%", scrub: true },
        });
      }

      cleanups.push(() => {
        section.classList.remove("is-enhanced");
        steps.forEach((s) => s.classList.remove("is-active"));
        imgs.forEach((im, k) => im.classList.toggle("is-active", k === 0));
      });
    });

    /* Horizontal timeline (service page): sticky viewport, track moves sideways */
    $$("[data-hscroll]").forEach((section) => {
      const track = section.querySelector("[data-hscroll-track]");
      const pinbox = section.querySelector("[data-hscroll-viewport]");
      if (!track || !pinbox) return;
      section.classList.add("is-enhanced");
      const distance = () => Math.max(0, track.scrollWidth - pinbox.clientWidth);
      // The section's height is sized from the travel distance, so the sticky viewport stays contained
      const size = () => section.style.setProperty("--hscroll-distance", distance() + "px");
      size();
      // RTL: the track overflows to the left, so it travels right to reveal the later steps.
      const travel = getComputedStyle(track).direction === "rtl" ? 1 : -1;
      gsap.to(track, {
        x: () => travel * distance(),
        ease: "none",
        scrollTrigger: {
          trigger: section.querySelector("[data-hscroll-runway]"),
          start: () => "top " + (headerOffset() + 24) + "px",
          end: () => "+=" + distance(),
          scrub: 0.4,
          invalidateOnRefresh: true,
          onRefreshInit: size,
        },
      });
      cleanups.push(() => {
        section.classList.remove("is-enhanced");
        section.style.removeProperty("--hscroll-distance");
      });
    });

    return () => cleanups.forEach((fn) => fn());
  });

  /* ---------------------------------------------------------
     Re-measure when layout changes after load
     --------------------------------------------------------- */
  let pending = 0;
  const refresh = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(() => ScrollTrigger.refresh());
  };
  // main.js loads this file after first paint, so the page may already be loaded.
  if (document.readyState === "complete") refresh();
  else window.addEventListener("load", refresh);
  window.addEventListener("layout:change", refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
})();
