/* ==========================================================================
   views/placeholders.js — clean "coming in a later step" screens
   Registered for every module not yet implemented so the navigation works
   end-to-end now. As each module is built, its real view file replaces the
   matching registration below (just delete the entry here).
   ========================================================================== */

(function () {
  const { el } = UI;

  // [route, title, icon, one-line description, build-order step]
  // All modules are now built — their real view files own these routes.
  const PENDING = [];

  PENDING.forEach(([route, title, ic, desc, step]) => {
    Router.register(route, {
      title,
      render(view) {
        view.appendChild(el('div.card.card-pad', { style: 'text-align:center;padding:48px 24px' }, [
          el('div.ei', { style: 'margin:0 auto 16px' }, [UI.icon(ic)]),
          el('h2', { style: 'font-size:19px;font-weight:800;letter-spacing:-.3px', text: title }),
          el('p', { class: 'muted',
            style: 'max-width:380px;margin:8px auto 18px;line-height:1.55;font-size:14px', text: desc }),
          el('span.pill.sky', [el('span.dot'), `Planned · build step ${step}`]),
        ]));
      },
    });
  });

  // Fallback for unknown routes
  Router.register('__notfound', {
    title: 'Not found',
    render(view) {
      view.appendChild(UI.empty({ icon: 'alert', title: 'Page not found',
        text: 'That screen does not exist.',
        action: { label: 'Back to dashboard', onClick: () => Router.go('dashboard') } }));
    },
  });
})();
