/**
 * The registry endpoint: list the monitored apps, or onboard a new one.
 *
 * POST accepts either a full `probes[]` definition or just a `baseUrl`, in
 * which case the three conventional probes are derived from it.
 */

import { addSite, loadConfig, standardProbes } from "@/lib/monitor/config";
import { listAdapters } from "@/lib/monitor/adapters";
import { guardMutation, mutationsAreProtected } from "@/lib/monitor/guard";
import { pollSiteNow, reconcile } from "@/lib/monitor/poller";
import type { ProbeConfig, SiteConfig } from "@/lib/monitor/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const { sites } = loadConfig();

  // Never echo the auth env var's value — only that one is configured.
  const safe = sites.map((site) => ({
    ...site,
    auth: site.auth ? { header: site.auth.header, env: site.auth.env } : undefined,
  }));

  return Response.json({
    sites: safe,
    adapters: listAdapters(),
    mutationsProtected: mutationsAreProtected(),
  });
}

type CreateBody = {
  id?: string;
  label?: string;
  baseUrl?: string;
  url?: string;
  blurb?: string;
  adapter?: string;
  probes?: ProbeConfig[];
  auth?: { header: string; env: string };
  tags?: string[];
};

export async function POST(request: Request) {
  const guard = guardMutation(request);
  if (!guard.ok) return guard.response;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const id = body.id?.trim();
  if (!id || !/^[a-z0-9][a-z0-9-]{0,62}$/i.test(id)) {
    return Response.json(
      { error: "invalid_id", hint: "lowercase letters, digits and dashes" },
      { status: 400 },
    );
  }

  const probes =
    body.probes && body.probes.length > 0
      ? body.probes
      : body.baseUrl
        ? standardProbes(body.baseUrl)
        : null;

  if (!probes) {
    return Response.json(
      { error: "probes_required", hint: "send probes[] or baseUrl" },
      { status: 400 },
    );
  }

  for (const probe of probes) {
    if (!/^https?:\/\//i.test(probe.url)) {
      return Response.json(
        { error: "invalid_probe_url", probe: probe.name },
        { status: 400 },
      );
    }
  }

  const site: SiteConfig = {
    id,
    label: body.label?.trim() || id,
    url: body.url ?? body.baseUrl,
    blurb: body.blurb,
    adapter: body.adapter ?? "generic",
    probes,
    auth: body.auth,
    tags: body.tags ?? [],
  };

  try {
    addSite(site);
  } catch (error) {
    const message = error instanceof Error ? error.message : "write_failed";
    if (message.startsWith("site_exists")) {
      return Response.json({ error: "site_exists" }, { status: 409 });
    }
    return Response.json({ error: "write_failed" }, { status: 500 });
  }

  // Start its recurring schedule, then take a first reading so the card is
  // populated by the time the user lands back on the console.
  reconcile();
  await pollSiteNow(site);

  return Response.json({ site }, { status: 201 });
}
