/* ============================================================
   Page motion. Sections rise gently into place as you reach them.

   Three rules this file obeys, all of them more important than the effect:

   1. Nothing is hidden until this script is running and has said so. The CSS
      that hides a section is locked behind the .js-motion class, and only
      this file ever adds it. If the script fails to load, or a browser
      refuses it, every page still renders in full rather than going blank.
      Animation that hides content by default is the most common way this
      effect quietly breaks a site.

   2. Nothing that is actually on screen is ever left hidden. The observer
      below is the normal path, but it takes its first look the moment the
      page loads, which can be before images and fonts have settled the
      layout. If it looks too early it can miss a section that is genuinely
      in view, and for a section near the bottom there is nothing further to
      scroll to, so it would stay invisible forever. The sweep is the net.

   3. If the reader's system asks for reduced motion, this does nothing at
      all. Not faster, not smaller. Nothing. Some people get motion sick.
   ============================================================ */
(function () {

  // Rule 3, checked before anything else happens.
  if (window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  // IntersectionObserver is the browser telling us when something scrolls
  // into view, instead of us asking on every scroll event and burning
  // battery to do it. If a browser is too old to have it, we do nothing at
  // all and the page is simply static, which is a fine outcome.
  if (!('IntersectionObserver' in window)) return;

  var targets = document.querySelectorAll('main > section, footer');
  if (!targets.length) return;

  // Rule 1. Only now, with the script definitely alive, is it safe to hide.
  document.documentElement.classList.add('js-motion');
  var pending = [];
  for (var i = 0; i < targets.length; i++) {
    targets[i].classList.add('reveal');
    pending.push(targets[i]);
  }

  // Sections already on screen at load are staggered so they arrive in
  // sequence rather than all at once. Anything scrolled to later appears as
  // it is reached, with no delay, so the page never feels slow to respond.
  var firstPass = true;
  var STAGGER_MS = 90;

  function reveal(el, delayMs) {
    el.style.transitionDelay = delayMs + 'ms';
    el.classList.add('is-visible');
    var at = pending.indexOf(el);
    if (at !== -1) pending.splice(at, 1);
    // Revealed once, revealed for good. Scrolling back up should not replay
    // it, and there is no reason to keep watching.
    observer.unobserve(el);
  }

  var observer = new IntersectionObserver(function (entries) {

    // The observer reports on everything it watches the first time it runs,
    // including sections far below the fold, so the ones actually on screen
    // have to be picked out before they can be counted for the stagger.
    var arriving = entries.filter(function (entry) {
      return entry.isIntersecting;
    });

    arriving.forEach(function (entry, index) {
      reveal(entry.target, firstPass ? index * STAGGER_MS : 0);
    });

    if (arriving.length) firstPass = false;

  }, {
    // Start the reveal slightly before a section reaches the bottom edge, so
    // it has settled by the time it is properly in view.
    rootMargin: '0px 0px -8% 0px',
    threshold: 0.05
  });

  for (var j = 0; j < targets.length; j++) {
    observer.observe(targets[j]);
  }

  // Rule 2, the net. Re-check anything still hidden once the layout has
  // actually settled, and reveal whatever turns out to be on screen. Uses a
  // plain rectangle test rather than the observer, so a missed callback
  // cannot cause a second miss.
  function sweep() {
    if (!pending.length) return;
    var viewportHeight = window.innerHeight ||
                         document.documentElement.clientHeight;
    var onScreen = pending.filter(function (el) {
      var box = el.getBoundingClientRect();
      return box.top < viewportHeight && box.bottom > 0;
    });
    onScreen.forEach(function (el, index) {
      reveal(el, firstPass ? index * STAGGER_MS : 0);
    });
    if (onScreen.length) firstPass = false;
  }

  window.addEventListener('load', sweep);
  setTimeout(sweep, 1200);

})();
