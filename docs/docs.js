/* ─────────────────────────────────────────
   nx-safe-suite Documentation — docs.js
   ───────────────────────────────────────── */

'use strict';

/* ── Section map: key → DOM id ── */
const SECTIONS = {
  'intro':             'sec-intro',
  'install':           'sec-install',
  'env':               'sec-env',
  'env-api':           'sec-env-api',
  'env-recipes':       'sec-env-recipes',
  'api-response':      'sec-api-response',
  'api-success':       'sec-api-success',
  'api-errors':        'sec-api-errors',
  'api-pagination':    'sec-api-pagination',
  'route-guard':       'sec-route-guard',
  'guard-api-routes':  'sec-guard-api-routes',
  'guard-actions':     'sec-guard-actions',
  'guard-rbac':        'sec-guard-rbac',
  'guard-rate':        'sec-guard-rate',
  'server-cache':      'sec-server-cache',
  'cache-layers':      'sec-cache-layers',
  'cache-tags':        'sec-cache-tags',
  'cache-swr':         'sec-cache-swr',
  'audit-log':         'sec-audit-log',
  'audit-transports':  'sec-audit-transports',
  'audit-masking':     'sec-audit-masking',
  'changelog':         'sec-changelog',
};

/* ── Sub-nav map: key → sub element id ── */
const SUBS = {
  'env':              'sub-env',
  'env-api':          'sub-env',
  'env-recipes':      'sub-env',
  'api-response':     'sub-api',
  'api-success':      'sub-api',
  'api-errors':       'sub-api',
  'api-pagination':   'sub-api',
  'route-guard':      'sub-guard',
  'guard-api-routes': 'sub-guard',
  'guard-actions':    'sub-guard',
  'guard-rbac':       'sub-guard',
  'guard-rate':       'sub-guard',
  'server-cache':     'sub-cache',
  'cache-layers':     'sub-cache',
  'cache-tags':       'sub-cache',
  'cache-swr':        'sub-cache',
  'audit-log':        'sub-audit',
  'audit-transports': 'sub-audit',
  'audit-masking':    'sub-audit',
};

const ALL_SUBS = ['sub-env', 'sub-api', 'sub-guard', 'sub-cache', 'sub-audit'];

let current = 'intro';

/**
 * Navigate to a documentation section and update the corresponding navigation state.
 * @param {string} key - The documentation section key.
 */

function navigate(key) {
  if (!SECTIONS[key]) return;

  /* Hide current section */
  const prevEl = document.getElementById(SECTIONS[current]);
  if (prevEl) prevEl.classList.remove('visible');

  /* Show new section */
  const nextEl = document.getElementById(SECTIONS[key]);
  if (nextEl) nextEl.classList.add('visible');

  /* Update sidebar active state */
  document.querySelectorAll('.nav-item').forEach(function(el) {
    el.classList.toggle(
      'active',
      el.getAttribute('onclick') === "navigate('" + key + "')"
    );
  });

  /* Update mobile bottom nav active state */
  document.querySelectorAll('.mobile-nav-btn').forEach(function(el) {
    el.classList.toggle(
      'active',
      el.getAttribute('data-key') === key
    );
  });

  /* Toggle sub-nav panels */
  ALL_SUBS.forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const subId = SUBS[key];
  if (subId) {
    const sub = document.getElementById(subId);
    if (sub) sub.style.display = 'block';
  }

  current = key;

  /* Update URL hash without triggering scroll */
  if (history.replaceState) {
    history.replaceState(null, '', '#' + key);
  }

  window.scrollTo({ top: 0, behavior: 'instant' });

  /* Close sidebar on mobile after navigating */
  if (window.innerWidth <= 768) closeSidebar();
}

/**
 * Opens the mobile sidebar and prevents background scrolling.
 */

function openSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('overlay');
  sidebar.classList.add('open');
  overlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

/**
 * Closes the mobile navigation sidebar and restores page scrolling.
 */
function closeSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('overlay');
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
  document.body.style.overflow = '';
}

/**
 * Toggles the mobile sidebar between its open and closed states.
 */
function toggleSidebar() {
  const isOpen = document.getElementById('sidebar').classList.contains('open');
  isOpen ? closeSidebar() : openSidebar();
}

/* ──────────────────────────────────────────
   INIT
   ────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', function() {

  /* Navigate to hash on load */
  const initialKey = window.location.hash.replace('#', '') || 'intro';
  navigate(Object.prototype.hasOwnProperty.call(SECTIONS, initialKey) ? initialKey : 'intro');

  /* Overlay click closes sidebar */
  const overlay = document.getElementById('overlay');
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  /* Escape key closes sidebar */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeSidebar();
  });

  /* Browser back/forward */
  window.addEventListener('popstate', function() {
    const key = window.location.hash.replace('#', '') || 'intro';
    if (SECTIONS[key]) navigate(key);
  });

  /* Swipe-right on mobile to close sidebar */
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', function(e) {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    /* Horizontal swipe with low vertical drift */
    if (Math.abs(dx) > 60 && Math.abs(dy) < 40) {
      const sidebar = document.getElementById('sidebar');
      if (dx < 0 && sidebar.classList.contains('open')) {
        closeSidebar();
      }
      if (dx > 0 && window.innerWidth <= 768 && touchStartX < 30) {
        openSidebar();
      }
    }
  }, { passive: true });

  /* Re-show sidebar on resize to desktop */
  window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
      closeSidebar();
      document.body.style.overflow = '';
    }
  });

});

/* Expose to inline onclick handlers */
window.navigate     = navigate;
window.toggleSidebar = toggleSidebar;
