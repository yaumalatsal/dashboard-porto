/**
 * The tracker script that other sites include.
 *
 * Add one line to any application you want to measure:
 *
 *   <script defer src="https://your-console/t.js" data-site="yourday"></script>
 *
 * `data-site` must match an application id in sites.json. The collector rejects
 * anything else, so a stranger who finds this file cannot write rows for a site
 * that does not exist.
 *
 * The body is deliberately small and has no dependencies. It is served with a
 * long cache lifetime because it almost never changes, and the site id comes
 * from the tag rather than from the file, so one cached copy serves every site.
 */

const TRACKER = `(function () {
  var tag = document.currentScript;
  if (!tag) return;
  var site = tag.getAttribute('data-site');
  if (!site) return;
  var endpoint = new URL(tag.src).origin + '/api/analytics/collect';
  var last = null;

  function send() {
    // A single-page application changes the path without a new document, so
    // the same path must not be counted twice in a row.
    var path = location.pathname;
    if (path === last) return;
    last = path;

    var body = JSON.stringify({
      site: site,
      path: path,
      referrer: document.referrer || undefined
    });

    try {
      // text/plain keeps this a simple request. An application/json body makes
      // the browser send a CORS preflight first, which doubles the requests and
      // fails outright if the preflight is blocked.
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }));
        return;
      }
      var xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.setRequestHeader('Content-Type', 'text/plain');
      xhr.send(body);
    } catch (e) {
      // Measurement must never break the page it measures.
    }
  }

  send();

  // Follow client-side navigation in a single-page application.
  var push = history.pushState;
  history.pushState = function () {
    push.apply(this, arguments);
    send();
  };
  addEventListener('popstate', send);
})();`;

export async function GET() {
  return new Response(TRACKER, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Immutable for a day: the file is identical for every site, and the site
      // id lives in the tag rather than in the body.
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
