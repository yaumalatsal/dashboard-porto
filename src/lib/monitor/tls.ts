/**
 * Certificate expiry checks.
 *
 * `fetch` gives no access to the peer certificate, so this opens its own TLS
 * socket, reads the certificate and closes immediately. It never sends a
 * request, so the check costs the monitored site one handshake and nothing
 * else.
 *
 * An expired certificate takes a public site down completely, and the usual
 * warning is a browser error reported by somebody else. A date in a table is a
 * cheaper way to find out.
 */

import tls from "node:tls";

export type CertificateInfo = {
  host: string;
  validTo: number;
  issuer: string | null;
  error?: string;
};

const TIMEOUT_MS = 8000;

/** A certificate attribute can repeat, so Node types these as string or array. */
function firstValue(field: string | string[] | undefined): string | null {
  if (Array.isArray(field)) return field[0] ?? null;
  return field ?? null;
}

export function checkCertificate(target: string): Promise<CertificateInfo | null> {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return Promise.resolve(null);
  }

  // Plain http has no certificate; that is not a fault to report.
  if (url.protocol !== "https:") return Promise.resolve(null);

  const host = url.hostname;
  const port = Number(url.port) || 443;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: CertificateInfo) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    const socket = tls.connect(
      {
        host,
        port,
        servername: host,
        // Read the certificate even when it fails validation. An expired or
        // self-signed certificate is exactly the case worth reporting, and
        // rejecting the connection would leave no date to show.
        rejectUnauthorized: false,
        timeout: TIMEOUT_MS,
      },
      () => {
        const cert = socket.getPeerCertificate();

        if (!cert || !cert.valid_to) {
          finish({ host, validTo: 0, issuer: null, error: "no_certificate" });
          return;
        }

        const validTo = Date.parse(cert.valid_to);
        finish({
          host,
          validTo: Number.isFinite(validTo) ? validTo : 0,
          issuer: firstValue(cert.issuer?.O) ?? firstValue(cert.issuer?.CN),
          error: Number.isFinite(validTo) ? undefined : "unreadable_date",
        });
      },
    );

    socket.on("timeout", () =>
      finish({ host, validTo: 0, issuer: null, error: "timeout" }),
    );
    socket.on("error", (error: Error) =>
      finish({ host, validTo: 0, issuer: null, error: error.message }),
    );
  });
}
