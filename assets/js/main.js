/* ==========================================================================
   STARLITE CHROME DINER - shared behaviour
   Vanilla JS, no dependencies, no build step.
   Every module is defensive: if its markup is absent on a page, it exits.
   ========================================================================== */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* ------------------------------------------------------------------
     1. MOBILE NAVIGATION
     ------------------------------------------------------------------ */
  function initNav() {
    var toggle = $('.nav-toggle');
    var nav = $('#primary-nav');
    if (!toggle || !nav) return;

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      $('.nav-toggle__label', toggle).textContent = open ? 'Close' : 'Menu';
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Escape closes the panel and returns focus to the trigger.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });

    // Reset state when crossing the desktop breakpoint so the CSS can take over.
    var desktop = window.matchMedia('(min-width: 1024px)');
    function syncBreakpoint() {
      if (desktop.matches) setOpen(false);
    }
    if (desktop.addEventListener) desktop.addEventListener('change', syncBreakpoint);
    else if (desktop.addListener) desktop.addListener(syncBreakpoint);
  }

  /* ------------------------------------------------------------------
     2. NAV DROPDOWNS (click + keyboard, closes on outside click / Escape)
     ------------------------------------------------------------------ */
  function initDropdowns() {
    var toggles = $$('.dropdown-toggle');
    if (!toggles.length) return;

    function closeAll(except) {
      toggles.forEach(function (t) {
        if (t === except) return;
        t.setAttribute('aria-expanded', 'false');
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.classList.remove('is-open');
      });
    }

    toggles.forEach(function (toggle) {
      var panel = document.getElementById(toggle.getAttribute('aria-controls'));
      if (!panel) return;

      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = toggle.getAttribute('aria-expanded') === 'true';
        closeAll(toggle);
        toggle.setAttribute('aria-expanded', String(!open));
        panel.classList.toggle('is-open', !open);
      });

      panel.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          toggle.setAttribute('aria-expanded', 'false');
          panel.classList.remove('is-open');
          toggle.focus();
        }
      });
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.has-dropdown')) closeAll(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll(null);
    });
  }

  /* ------------------------------------------------------------------
     3. ACCORDIONS (FAQ and anywhere else)
     ------------------------------------------------------------------ */
  function initAccordions() {
    var triggers = $$('.accordion__trigger');
    if (!triggers.length) return;

    triggers.forEach(function (trigger) {
      var panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!panel) return;

      trigger.addEventListener('click', function () {
        var expanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!expanded));
        panel.hidden = expanded;
      });
    });

    // Deep link support: /faq.html#q-parking opens that panel.
    if (window.location.hash) {
      var target = document.getElementById(window.location.hash.slice(1));
      if (target && target.classList.contains('accordion__panel')) {
        var owner = document.querySelector('[aria-controls="' + target.id + '"]');
        if (owner) {
          owner.setAttribute('aria-expanded', 'true');
          target.hidden = false;
        }
      }
    }
  }

  /* ------------------------------------------------------------------
     4. FORM VALIDATION
     Inline messages under each field, plus a summary at the top of the form.
     Nothing is submitted to a server in this build: forms confirm inline and
     tell the guest exactly what happens next.
     ------------------------------------------------------------------ */
  var VALIDATORS = {
    email: {
      test: function (v) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v); },
      message: 'Enter a valid email address, for example jamie@example.com.'
    },
    tel: {
      test: function (v) { return /^\+?1?[\s.\-(]*\d{3}[\s.\-)]*\d{3}[\s.\-]*\d{4}$/.test(v.trim()); },
      message: 'Enter a 10 digit US phone number, for example (505) 555-0142.'
    },
    zip: {
      test: function (v) { return /^\d{5}(-\d{4})?$/.test(v.trim()); },
      message: 'Enter a 5 digit US ZIP code.'
    }
  };

  function fieldWrap(input) { return input.closest('.field') || input.closest('.fieldset'); }

  function showError(input, message) {
    var wrap = fieldWrap(input);
    if (!wrap) return;
    wrap.classList.add('has-error');
    var msg = $('.error-msg', wrap);
    if (msg) msg.textContent = message;
    input.setAttribute('aria-invalid', 'true');
  }

  function clearError(input) {
    var wrap = fieldWrap(input);
    if (!wrap) return;
    wrap.classList.remove('has-error');
    input.removeAttribute('aria-invalid');
  }

  function validateInput(input) {
    var value = input.value == null ? '' : String(input.value);
    var label = input.dataset.label || (fieldWrap(input) && $('label', fieldWrap(input)) ? $('label', fieldWrap(input)).textContent.replace('*', '').trim() : 'This field');

    if (input.type === 'checkbox' && input.required && !input.checked) {
      showError(input, input.dataset.errorRequired || 'Please tick this box to continue.');
      return false;
    }
    if (input.required && !value.trim()) {
      showError(input, input.dataset.errorRequired || label + ' is required.');
      return false;
    }
    if (!value.trim()) { clearError(input); return true; }

    var kind = input.dataset.validate || (input.type === 'email' ? 'email' : (input.type === 'tel' ? 'tel' : ''));
    if (kind && VALIDATORS[kind] && !VALIDATORS[kind].test(value)) {
      showError(input, VALIDATORS[kind].message);
      return false;
    }
    if (input.minLength > 0 && value.trim().length < input.minLength) {
      showError(input, label + ' needs at least ' + input.minLength + ' characters.');
      return false;
    }
    if (input.type === 'date' && input.min && value < input.min) {
      showError(input, 'Pick a date from ' + input.min + ' onward.');
      return false;
    }
    if (input.type === 'number') {
      var n = Number(value);
      if (input.min !== '' && n < Number(input.min)) { showError(input, label + ' must be at least ' + input.min + '.'); return false; }
      if (input.max !== '' && n > Number(input.max)) { showError(input, label + ' must be ' + input.max + ' or fewer.'); return false; }
    }
    clearError(input);
    return true;
  }

  function initForms() {
    var forms = $$('form[data-validate-form]');
    if (!forms.length) return;

    forms.forEach(function (form) {
      var fields = $$('input, select, textarea', form).filter(function (el) {
        return el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button';
      });

      fields.forEach(function (input) {
        // Validate on blur, then live-correct once the field has been touched.
        input.addEventListener('blur', function () { validateInput(input); });
        input.addEventListener('input', function () {
          if (fieldWrap(input) && fieldWrap(input).classList.contains('has-error')) validateInput(input);
        });
        input.addEventListener('change', function () {
          if (input.type === 'checkbox' || input.tagName === 'SELECT') validateInput(input);
        });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var invalid = [];
        fields.forEach(function (input) { if (!validateInput(input)) invalid.push(input); });

        var summary = $('.error-summary', form);
        var status = $('.form-status', form);

        if (invalid.length) {
          if (status) status.classList.remove('is-visible');
          if (summary) {
            var list = $('ul', summary);
            list.innerHTML = '';
            invalid.forEach(function (input) {
              if (!input.id) input.id = 'field-' + Math.random().toString(36).slice(2, 8);
              var li = document.createElement('li');
              var a = document.createElement('a');
              a.href = '#' + input.id;
              a.textContent = ($('.error-msg', fieldWrap(input)) || {}).textContent || 'Check this field';
              a.addEventListener('click', function (ev) { ev.preventDefault(); input.focus(); });
              li.appendChild(a);
              list.appendChild(li);
            });
            summary.classList.add('is-visible');
            summary.setAttribute('tabindex', '-1');
            summary.focus();
          } else {
            invalid[0].focus();
          }
          return;
        }

        if (summary) summary.classList.remove('is-visible');
        if (status) {
          status.classList.add('is-visible');
          status.setAttribute('tabindex', '-1');
          status.focus();
        }
        form.reset();
        fields.forEach(clearError);
      });
    });
  }

  /* ------------------------------------------------------------------
     5. COOKIE CONSENT
     No non-essential cookie or tracker is set before an explicit choice.
     Consent itself is stored in localStorage, which is strictly necessary
     for remembering the guest's decision.
     ------------------------------------------------------------------ */
  var CONSENT_KEY = 'starlite-consent-v1';

  function readConsent() {
    try { return JSON.parse(window.localStorage.getItem(CONSENT_KEY)); }
    catch (err) { return null; }
  }

  function writeConsent(value) {
    try {
      window.localStorage.setItem(CONSENT_KEY, JSON.stringify({
        analytics: !!value.analytics,
        advertising: !!value.advertising,
        date: new Date().toISOString()
      }));
    } catch (err) { /* storage blocked: the banner simply reappears next visit */ }
  }

  function applyConsent(value) {
    // Hook point. Analytics and advertising tags load here and nowhere else.
    window.starliteConsent = value;
    document.documentElement.dataset.consentAnalytics = value.analytics ? 'granted' : 'denied';
    document.documentElement.dataset.consentAds = value.advertising ? 'granted' : 'denied';
  }

  function initCookies() {
    var banner = $('#cookie-banner');
    var dialog = $('#cookie-prefs');
    if (!banner) return;

    var stored = readConsent();
    if (stored) applyConsent(stored);
    else banner.classList.add('is-visible');

    function finish(value) {
      writeConsent(value);
      applyConsent(value);
      banner.classList.remove('is-visible');
      if (dialog && dialog.open) dialog.close();
    }

    var acceptBtn = $('#cookie-accept', banner);
    var rejectBtn = $('#cookie-reject', banner);
    var manageBtn = $('#cookie-manage', banner);

    if (acceptBtn) acceptBtn.addEventListener('click', function () { finish({ analytics: true, advertising: true }); });
    if (rejectBtn) rejectBtn.addEventListener('click', function () { finish({ analytics: false, advertising: false }); });

    if (manageBtn && dialog) {
      manageBtn.addEventListener('click', function () {
        var current = readConsent() || { analytics: false, advertising: false };
        var a = $('#pref-analytics', dialog);
        var ad = $('#pref-advertising', dialog);
        if (a) a.checked = current.analytics;
        if (ad) ad.checked = current.advertising;
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      });
    }

    // Any page can expose a "cookie settings" link that reopens preferences.
    $$('[data-open-cookie-prefs]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        if (!dialog) return;
        var current = readConsent() || { analytics: false, advertising: false };
        var a = $('#pref-analytics', dialog);
        var ad = $('#pref-advertising', dialog);
        if (a) a.checked = current.analytics;
        if (ad) ad.checked = current.advertising;
        if (typeof dialog.showModal === 'function') dialog.showModal();
      });
    });

    if (dialog) {
      var save = $('#pref-save', dialog);
      var acceptAll = $('#pref-accept-all', dialog);
      var rejectAll = $('#pref-reject-all', dialog);
      var close = $('#pref-close', dialog);
      if (save) save.addEventListener('click', function () {
        finish({
          analytics: $('#pref-analytics', dialog).checked,
          advertising: $('#pref-advertising', dialog).checked
        });
      });
      if (acceptAll) acceptAll.addEventListener('click', function () { finish({ analytics: true, advertising: true }); });
      if (rejectAll) rejectAll.addEventListener('click', function () { finish({ analytics: false, advertising: false }); });
      if (close) close.addEventListener('click', function () { dialog.close(); });
    }
  }

  /* ------------------------------------------------------------------
     6. BACK TO TOP
     ------------------------------------------------------------------ */
  function initBackToTop() {
    var btn = $('.to-top');
    if (!btn) return;

    // IntersectionObserver on a sentinel avoids a scroll listener entirely.
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:640px;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.appendChild(sentinel);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        btn.classList.toggle('is-visible', !entries[0].isIntersecting);
      }).observe(sentinel);
    } else {
      btn.classList.add('is-visible');
    }

    btn.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion.matches ? 'auto' : 'smooth'
      });
      var skip = $('.skip-link');
      if (skip) skip.focus();
    });
  }

  /* ------------------------------------------------------------------
     7. IMAGE FALLBACK
     Hosted photography can move or rate-limit. If a photo fails we swap in a
     same-sized replacement rather than leaving a broken image icon.
     ------------------------------------------------------------------ */
  function initImageFallback() {
    $$('img').forEach(function (img) {
      img.addEventListener('error', function handle() {
        img.removeEventListener('error', handle);
        var w = img.getAttribute('width') || 800;
        var h = img.getAttribute('height') || 600;
        var seed = encodeURIComponent((img.getAttribute('alt') || 'starlite diner').slice(0, 40));
        img.src = 'https://picsum.photos/seed/' + seed + '/' + w + '/' + h;
      });
    });
  }

  /* ------------------------------------------------------------------
     8. SCROLL REVEAL
     Content ships visible. The class that hides it is added by JS only, so a
     no-JS or headless render never ends up with a blank section.
     ------------------------------------------------------------------ */
  function initReveal() {
    if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) return;
    var items = $$('.js-reveal');
    if (!items.length) return;

    items.forEach(function (el, i) {
      el.classList.add('reveal-ready');
      el.style.transitionDelay = Math.min(i % 4, 3) * 70 + 'ms';
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------
     9. GALLERY LIGHTBOX
     ------------------------------------------------------------------ */
  function initLightbox() {
    var dialog = $('#lightbox');
    var triggers = $$('.gallery-item');
    if (!dialog || !triggers.length) return;

    var img = $('#lightbox-img', dialog);
    var cap = $('#lightbox-cap', dialog);
    var counter = $('#lightbox-count', dialog);
    var prev = $('#lightbox-prev', dialog);
    var next = $('#lightbox-next', dialog);
    var index = 0;

    function show(i) {
      index = (i + triggers.length) % triggers.length;
      var source = $('img', triggers[index]);
      var caption = $('.gallery-item__cap', triggers[index]);
      img.src = source.dataset.full || source.src;
      img.alt = source.alt;
      cap.textContent = caption ? caption.textContent : source.alt;
      counter.textContent = (index + 1) + ' of ' + triggers.length;
    }

    triggers.forEach(function (btn, i) {
      btn.addEventListener('click', function () {
        show(i);
        if (typeof dialog.showModal === 'function') dialog.showModal();
      });
    });

    if (prev) prev.addEventListener('click', function () { show(index - 1); });
    if (next) next.addEventListener('click', function () { show(index + 1); });

    dialog.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    });

    dialog.addEventListener('close', function () {
      if (triggers[index]) triggers[index].focus();
    });

    var close = $('#lightbox-close', dialog);
    if (close) close.addEventListener('click', function () { dialog.close(); });
  }

  /* ------------------------------------------------------------------
     10. ORDER BUILDER (first-party online ordering)
     Prices are the same as the dine-in menu. Nothing hidden is added.
     ------------------------------------------------------------------ */
  function initOrder() {
    var root = $('#order-builder');
    if (!root) return;

    var listEl = $('#cart-items');
    var emptyEl = $('#cart-empty');
    var subtotalEl = $('#cart-subtotal');
    var taxEl = $('#cart-tax');
    var totalEl = $('#cart-total');
    var countEl = $('#cart-count');
    var methodInputs = $$('input[name="fulfilment"]');
    var TAX_RATE = 0.07875; // Albuquerque combined gross receipts rate, shown before checkout.
    var cart = [];

    function money(n) { return '$' + n.toFixed(2); }

    function render() {
      listEl.innerHTML = '';
      var subtotal = 0;
      cart.forEach(function (line, i) {
        subtotal += line.price * line.qty;
        var li = document.createElement('li');
        var name = document.createElement('span');
        name.textContent = line.qty + ' × ' + line.name;
        var right = document.createElement('span');
        right.textContent = money(line.price * line.qty) + ' ';
        var remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'btn btn--sm';
        remove.style.marginLeft = '0.5rem';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', 'Remove ' + line.name + ' from your order');
        remove.addEventListener('click', function () { cart.splice(i, 1); render(); });
        right.appendChild(remove);
        li.appendChild(name);
        li.appendChild(right);
        listEl.appendChild(li);
      });

      emptyEl.hidden = cart.length > 0;
      var tax = subtotal * TAX_RATE;
      subtotalEl.textContent = money(subtotal);
      taxEl.textContent = money(tax);
      totalEl.textContent = money(subtotal + tax);
      if (countEl) countEl.textContent = String(cart.reduce(function (a, b) { return a + b.qty; }, 0));
    }

    $$('[data-add-to-order]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var name = btn.dataset.name;
        var price = parseFloat(btn.dataset.price);
        var existing = cart.filter(function (l) { return l.name === name; })[0];
        if (existing) existing.qty += 1;
        else cart.push({ name: name, price: price, qty: 1 });
        render();
        var live = $('#order-live');
        if (live) live.textContent = name + ' added to your order.';
      });
    });

    methodInputs.forEach(function (input) {
      input.addEventListener('change', function () {
        var note = $('#fulfilment-note');
        if (!note) return;
        note.textContent = input.value === 'delivery'
          ? 'First party delivery inside a 4 mile radius. Flat $4.95 delivery charge, shown on this page before you pay. No service fee, no markup on menu prices.'
          : 'Pickup at the counter. No fees of any kind. Most orders are ready in 15 to 20 minutes.';
      });
    });

    render();
  }

  /* ------------------------------------------------------------------
     11. GIFT CARD AMOUNT PICKER
     ------------------------------------------------------------------ */
  function initGiftCard() {
    var group = $('#gift-amounts');
    if (!group) return;
    var custom = $('#gift-custom');
    var display = $('#gift-total');

    function update() {
      var checked = $('input[name="amount"]:checked', group);
      var value = checked ? checked.value : '';
      if (value === 'custom') {
        if (custom) custom.closest('.field').hidden = false;
        value = custom && custom.value ? custom.value : '0';
      } else if (custom) {
        custom.closest('.field').hidden = true;
      }
      var qtyEl = $('#gift-qty');
      var qty = qtyEl ? Math.max(1, parseInt(qtyEl.value, 10) || 1) : 1;
      if (display) display.textContent = '$' + (Number(value || 0) * qty).toFixed(2);
    }

    $$('input[name="amount"]', group).forEach(function (i) { i.addEventListener('change', update); });
    if (custom) custom.addEventListener('input', update);
    var qtyEl = $('#gift-qty');
    if (qtyEl) qtyEl.addEventListener('input', update);
    update();
  }

  /* ------------------------------------------------------------------
     12. MENU FILTER (dietary tags on the full menu page)
     ------------------------------------------------------------------ */
  function initMenuFilter() {
    var controls = $('#menu-filter');
    if (!controls) return;
    var items = $$('.menu-item');
    var live = $('#menu-filter-status');

    function apply() {
      var active = $$('input:checked', controls).map(function (i) { return i.value; });
      var shown = 0;
      items.forEach(function (item) {
        var diets = (item.dataset.diet || '').split(' ');
        var match = active.every(function (a) { return diets.indexOf(a) !== -1; });
        item.hidden = !match;
        if (match) shown++;
      });
      $$('.course').forEach(function (course) {
        var visible = $$('.menu-item', course).filter(function (i) { return !i.hidden; });
        course.hidden = visible.length === 0;
      });
      if (live) live.textContent = shown + ' of ' + items.length + ' dishes shown.';
    }

    $$('input', controls).forEach(function (i) { i.addEventListener('change', apply); });
    var reset = $('#menu-filter-reset');
    if (reset) reset.addEventListener('click', function () {
      $$('input', controls).forEach(function (i) { i.checked = false; });
      apply();
    });
  }

  /* ------------------------------------------------------------------
     13. MARQUEE: duplicate the track so the loop is seamless
     ------------------------------------------------------------------ */
  function initMarquee() {
    $$('.marquee__track').forEach(function (track) {
      if (prefersReducedMotion.matches) return;
      // A seamless loop needs the content twice. The clone is hidden from
      // assistive technology so the strip is not announced twice over.
      var clone = document.createElement('span');
      clone.style.display = 'contents';
      clone.setAttribute('aria-hidden', 'true');
      clone.innerHTML = track.innerHTML;
      track.appendChild(clone);
    });
  }

  /* ------------------------------------------------------------------
     14. CURRENT YEAR in footers
     ------------------------------------------------------------------ */
  function initYear() {
    $$('[data-year]').forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /* ------------------------------------------------------------------
     BOOT
     ------------------------------------------------------------------ */
  function boot() {
    initNav();
    initDropdowns();
    initAccordions();
    initForms();
    initCookies();
    initBackToTop();
    initImageFallback();
    initReveal();
    initLightbox();
    initOrder();
    initGiftCard();
    initMenuFilter();
    initMarquee();
    initYear();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
