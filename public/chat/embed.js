// Adds a chat button to a business's website. Paste this one line before </body>:
//   <script src="https://nova-systems.app/chat/embed.js" data-business="YOUR-PAGE-NAME" async></script>
// The chat itself runs in a frame from nova-systems.app, so it never reads the host page.
(function () {
  var me = document.currentScript;
  var slug = ((me && me.getAttribute('data-business')) || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) || window.__novaChat) return;
  window.__novaChat = true;
  var origin = new URL(me.src).origin, frame = null, open = false;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Chat with us';
  btn.setAttribute('aria-expanded', 'false');
  btn.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483000;background:#1b2430;color:#fff;border:0;border-radius:999px;padding:14px 20px;font:700 15px system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer';
  btn.addEventListener('click', function () {
    if (!frame) {
      frame = document.createElement('iframe');
      frame.src = origin + '/chat?b=' + encodeURIComponent(slug);
      frame.title = 'Chat';
      frame.style.cssText = 'position:fixed;right:20px;bottom:84px;z-index:2147483000;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 110px));border:1px solid #e3ded3;border-radius:14px;background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.25);display:none';
      document.body.appendChild(frame);
    }
    open = !open;
    frame.style.display = open ? 'block' : 'none';
    btn.textContent = open ? 'Close chat' : 'Chat with us';
    btn.setAttribute('aria-expanded', String(open));
  });
  (document.body ? Promise.resolve() : new Promise(function (r) { document.addEventListener('DOMContentLoaded', r); })).then(function () { document.body.appendChild(btn); });
})();
