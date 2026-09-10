/**
 * Deposit wallets — the addresses buyers actually send money to.
 *
 * This edits `server/gateways.json`, which used to be a hand-edited file on the
 * box. orders.mjs re-reads it per request, so a save is live on the next order
 * with no restart and no deploy.
 *
 * Nothing here is forgiving: a typo'd address sends a customer's payment
 * somewhere unrecoverable. The server validates the whole document again before
 * it writes, and the write is atomic (temp file + rename) so a crash mid-save
 * can never leave a truncated file behind — an unreadable gateways.json takes
 * the entire payment flow down.
 *
 * The page reads as a list, not a form: one collapsed row per network showing
 * the four things an operator checks at a glance (label, chain, address, who
 * confirms it), opened only to edit. `wallet-checks.ts` runs the server's own
 * rules as you type, so a bad row is flagged in place instead of coming back
 * as `rpc_required:USDT/ERC-20` after a rejected save.
 */
import { useEffect, useMemo, useState } from 'react';
import { api, type Gateway, type GatewayNetwork, type GatewaysDoc } from '../data';
import {
  Button, Card, Chip, Confirm, EmptyState, Field, Icon, IconButton, Select, SkeletonText,
  TextInput, Toggle, CopyValue,
} from '../ui';
import { CHAINS, checkWallets, locateServerError } from './wallet-checks';
/* The Mini App's own coin/network art, and the same lookup the payment screen
   uses — so a currency with no icon here is exactly the one the picker drops. */
import { currencyIcon, networkIcon } from '../../screens/payment/gatewayDisplay';

const CHAIN_OPTIONS = CHAINS.map((c) => ({ value: c, label: c.toUpperCase() }));

/** Sensible starting points per chain, so a new row is mostly right already —
 *  wrong decimals are the one mistake that silently breaks amount matching. */
const CHAIN_DEFAULTS: Record<string, { decimals: number; requiredConfirmations: number }> = {
  evm: { decimals: 18, requiredConfirmations: 12 },
  btc: { decimals: 8, requiredConfirmations: 2 },
  tron: { decimals: 6, requiredConfirmations: 1 },
  sol: { decimals: 9, requiredConfirmations: 1 },
  ton: { decimals: 9, requiredConfirmations: 1 },
};

const blankNetwork = (): GatewayNetwork => ({
  network: '', address: '', chain: 'evm', rpc: '', ...CHAIN_DEFAULTS.evm,
});

const key = (ci: number, ni: number) => `${ci}:${ni}`;
const shorten = (a: string) => (a.length > 22 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a);

export default function Wallets() {
  const [doc, setDoc] = useState<GatewaysDoc | null>(null);
  const [baseline, setBaseline] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<{ ci: number; ni: number | null } | null>(null);
  const [showProblems, setShowProblems] = useState(false);

  /* Not `useAsync`: that hook has no failure state, so a load that 404s or
     throws leaves the page skeletonised forever. An editor for live wallets
     has to say when it could not read them. */
  useEffect(() => {
    let live = true;
    api.gateways()
      .then((d) => {
        if (!live) return;
        const gateways = d.gateways ?? [];
        setDoc({ gateways });
        setBaseline(JSON.stringify(gateways));
        // Something already broken on disk is worth saying before it is touched.
        if (checkWallets(gateways).length) setShowProblems(true);
      })
      .catch((e) => live && setLoadError(e instanceof Error ? e.message : 'Could not load the wallets.'));
    return () => { live = false; };
  }, []);

  const problems = useMemo(() => checkWallets(doc?.gateways ?? []), [doc]);
  const dirty = !!doc && JSON.stringify(doc.gateways) !== baseline;

  /* A half-typed address is worth a browser warning — the page is the only
     copy of the edit, and there is no draft anywhere. */
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (loadError) {
    return (
      <>
        <Head />
        <Card>
          <EmptyState
            icon="alert"
            title="Could not load the deposit wallets"
            hint={`${loadError} — the payment flow reads the same file, so check the API before taking new orders.`}
          />
        </Card>
      </>
    );
  }

  if (!doc) {
    return (
      <>
        <Head />
        <Card><SkeletonText lines={6} /></Card>
      </>
    );
  }

  /* One row is open at a time by default: an editor of eight fields is only
     legible on its own, and the list above it is the point of the page. */
  const toggle = (k: string) => setOpen((s) => (s.has(k) ? new Set() : new Set([k])));

  const edit = (fn: (g: Gateway[]) => Gateway[]) => {
    setDoc({ gateways: fn(structuredClone(doc.gateways)) });
    setSaved(false);
    setError('');
  };

  const patchNetwork = (ci: number, ni: number, patch: Partial<GatewayNetwork>) =>
    edit((gs) => {
      Object.assign(gs[ci].networks[ni], patch);
      return gs;
    });

  const addNetwork = (ci: number) => {
    edit((gs) => { gs[ci].networks.push(blankNetwork()); return gs; });
    setOpen(new Set([key(ci, doc.gateways[ci].networks.length)]));
  };

  const problemsFor = (ci: number, ni: number | null) =>
    problems.filter((p) => p.ci === ci && p.ni === ni);
  /** A field's own complaint in red, or its ordinary hint. */
  const messageFor = (ci: number, ni: number | null, field: string) => {
    const p = problems.find((q) => q.ci === ci && q.ni === ni && q.field === field);
    return p ? <span className="a-walletbad__hint">{p.message}</span> : undefined;
  };

  const save = async () => {
    if (problems.length) { setShowProblems(true); return; }
    setSaving(true);
    setError('');
    try {
      const next = await api.saveGateways(doc);
      setDoc({ gateways: next.gateways });
      setBaseline(JSON.stringify(next.gateways));
      setSaved(true);
      setOpen(new Set());
    } catch (e) {
      // The server re-validates and names the offending entry, e.g.
      // "invalid_address:USDT/BEP-20" — open that row rather than printing
      // the code and leaving the operator to find it.
      const code = e instanceof Error ? e.message : 'Could not save.';
      const at = locateServerError(code, doc.gateways);
      setError(at ? `${at.message} (${code})` : code);
      if (at && at.ni !== null) setOpen(new Set([key(at.ci, at.ni)]));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setDoc({ gateways: JSON.parse(baseline) });
    setOpen(new Set());
    setError('');
    setShowProblems(false);
  };

  const nets = doc.gateways.flatMap((g) => g.networks);
  const watched = nets.filter((n) => !n.manualOnly).length;

  return (
    <>
      <Head />

      <div className="a-walletsum">
        <span><b>{doc.gateways.length}</b> {doc.gateways.length === 1 ? 'currency' : 'currencies'}</span>
        <span className="a-walletsum__dot" />
        <span><b>{nets.length}</b> {nets.length === 1 ? 'network' : 'networks'}</span>
        <span className="a-walletsum__dot" />
        <span>
          <Icon name="check" size={14} /> {watched} watched
        </span>
        {nets.length - watched > 0 && (
          <>
            <span className="a-walletsum__dot" />
            <span className="a-walletsum__manual">
              <Icon name="user" size={14} /> {nets.length - watched} confirmed by hand
            </span>
          </>
        )}
        {problems.length > 0 && (
          <button type="button" className="a-walletsum__bad" onClick={() => setShowProblems(true)}>
            <Icon name="alert" size={14} />
            {problems.length} {problems.length === 1 ? 'problem' : 'problems'}
          </button>
        )}
      </div>

      {showProblems && problems.length > 0 && (
        <Card className="a-walletcard--bad">
          <div className="a-walletbad">
            <Icon name="alert" size={18} />
            <div>
              <b>These have to be fixed before the wallets can be saved.</b>
              <ul>
                {problems.map((p, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => p.ni !== null && toggle(key(p.ci, p.ni))}>
                      {doc.gateways[p.ci]?.currency || 'New currency'}
                      {p.ni !== null && ` / ${doc.gateways[p.ci]?.networks[p.ni]?.network || 'new network'}`}
                    </button>
                    {' — '}{p.message}
                  </li>
                ))}
              </ul>
            </div>
            <IconButton icon="close" label="Hide" onClick={() => setShowProblems(false)} />
          </div>
        </Card>
      )}

      {doc.gateways.length === 0 && (
        <Card>
          <EmptyState
            icon="wallet"
            title="No deposit wallets configured"
            hint="Until a currency is added here, the payment screen has nothing to offer."
          />
        </Card>
      )}

      {doc.gateways.map((g, ci) => (
        <Card
          key={ci}
          flush
          className={problemsFor(ci, null).length ? 'a-walletcard--bad' : ''}
        >
          <header className="a-wallethead">
            {currencyIcon(g.currency)
              ? <img className="a-wallethead__coin" src={currencyIcon(g.currency)} alt="" />
              : <span className="a-wallethead__tick">{(g.currency || '—').slice(0, 4)}</span>}
            <div className="a-wallethead__fields">
              <Field
                label="Ticker"
                /* No art for the ticker means the Mini App hides the currency
                   outright — a wallet nobody can pay into. Worth saying here,
                   where the ticker is typed. */
                hint={messageFor(ci, null, 'currency')
                  ?? (g.currency && !currencyIcon(g.currency)
                    ? <span className="a-walletwarn__hint">No icon in the app — buyers never see this currency.</span>
                    : undefined)}
              >
                <TextInput
                  value={g.currency}
                  onChange={(v) => edit((gs) => { gs[ci].currency = v.trim().toUpperCase(); return gs; })}
                  placeholder="USDT"
                />
              </Field>
              <Field label="Display name">
                <TextInput
                  value={g.name ?? ''}
                  onChange={(v) => edit((gs) => { gs[ci].name = v; return gs; })}
                  placeholder="Tether"
                />
              </Field>
            </div>
            <IconButton
              icon="trash"
              label={`Remove ${g.currency || 'this currency'}`}
              danger
              onClick={() => setConfirming({ ci, ni: null })}
            />
          </header>

          <div className="a-walletrows">
            {g.networks.map((n, ni) => {
              const k = key(ci, ni);
              const isOpen = open.has(k);
              const bad = problemsFor(ci, ni);
              const icon = networkIcon(n.network) ?? currencyIcon(g.currency);
              return (
                <div key={ni} className={`a-walletrow${isOpen ? ' is-open' : ''}${bad.length ? ' is-bad' : ''}`}>
                  {/* A div, not a button: the address inside it is its own
                      copy button, and a button cannot contain one. */}
                  <div
                    className="a-walletrow__head"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    onClick={() => toggle(k)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(k); }
                    }}
                  >
                    <Icon name="chevron-down" size={16} className="a-walletrow__caret" />
                    {/* The network's own art where the app has it, the coin's
                        otherwise — the same fallback the picker itself uses.
                        With neither, an empty plate keeps the columns lined up. */}
                    {icon
                      ? <img className="a-walletrow__icon" src={icon} alt="" />
                      : <span className="a-walletrow__icon" />}
                    <span className="a-walletrow__name">{n.network || <em>New network</em>}</span>
                    <Chip tone="neutral">{(n.chain ?? 'evm').toUpperCase()}</Chip>
                    <span className="a-walletrow__addr">
                      {n.address
                        ? <CopyValue value={n.address} label="address" display={shorten(n.address)} />
                        : <span className="at-muted">no address</span>}
                    </span>
                    <span className="a-walletrow__conf at-muted">
                      {n.requiredConfirmations ?? 0} conf
                    </span>
                    {n.manualOnly
                      ? <Chip tone="warn">Manual</Chip>
                      : <Chip tone="success">Watched</Chip>}
                    {bad.length > 0 && (
                      <span className="a-walletrow__bad" title={bad.map((p) => p.message).join('\n')}>
                        <Icon name="alert" size={15} />
                      </span>
                    )}
                  </div>

                  {isOpen && (
                    <div className="a-walletrow__body">
                      <div className="a-grid a-grid--2">
                        <Field label="Network" hint={messageFor(ci, ni, 'network') ?? 'The label the buyer picks, e.g. BEP-20.'}>
                          <TextInput
                            value={n.network}
                            onChange={(v) => patchNetwork(ci, ni, { network: v.trim() })}
                            placeholder="BEP-20"
                          />
                        </Field>
                        <Field
                          label="Chain"
                          hint={messageFor(ci, ni, 'chain')
                            ?? (n.manualOnly ? 'Ignored while manual-only.' : 'Which watcher adapter polls it.')}
                        >
                          <Select
                            value={(n.chain ?? 'evm') as typeof CHAINS[number]}
                            onChange={(v) => patchNetwork(ci, ni, { chain: v, ...CHAIN_DEFAULTS[v] })}
                            options={CHAIN_OPTIONS}
                            disabled={n.manualOnly}
                          />
                        </Field>
                      </div>

                      <Field
                        label="Receiving address"
                        hint={messageFor(ci, ni, 'address')
                          ?? 'Checked again by the server before it saves. Money sent to a wrong address here is not recoverable.'}
                      >
                        <TextInput
                          value={n.address}
                          onChange={(v) => patchNetwork(ci, ni, { address: v.trim() })}
                          placeholder="0x…"
                        />
                      </Field>

                      <div className="a-grid a-grid--2">
                        <Field
                          label="Decimals"
                          hint={messageFor(ci, ni, 'decimals')
                            ?? 'Base units per whole coin — 6 for USDT-TRC20, 18 on BEP-20. A wrong value breaks amount matching.'}
                        >
                          <TextInput
                            value={String(n.decimals ?? '')}
                            onChange={(v) => patchNetwork(ci, ni, { decimals: Number(v) })}
                            type="number"
                          />
                        </Field>
                        <Field
                          label="Confirmations"
                          hint={messageFor(ci, ni, 'requiredConfirmations') ?? 'Blocks before the payment is treated as final.'}
                        >
                          <TextInput
                            value={String(n.requiredConfirmations ?? '')}
                            onChange={(v) => patchNetwork(ci, ni, { requiredConfirmations: Number(v) })}
                            type="number"
                          />
                        </Field>
                      </div>

                      <div className="a-grid a-grid--2">
                        <Field label="Token contract" optional hint="Leave empty for a native coin.">
                          <TextInput
                            value={n.tokenContract ?? ''}
                            onChange={(v) => patchNetwork(ci, ni, { tokenContract: v.trim() })}
                          />
                        </Field>
                        <Field
                          label="RPC endpoint"
                          optional={!!n.manualOnly || n.chain !== 'evm'}
                          hint={messageFor(ci, ni, 'rpc') ?? 'Required for EVM chains. HTTPS only.'}
                        >
                          <TextInput
                            value={n.rpc ?? ''}
                            onChange={(v) => patchNetwork(ci, ni, { rpc: v.trim() })}
                            placeholder="https://bsc-rpc.publicnode.com"
                          />
                        </Field>
                      </div>

                      <Field label="Memo / tag" optional hint="Shown to the buyer. Never used to match a payment.">
                        <TextInput
                          value={n.memo ?? ''}
                          onChange={(v) => patchNetwork(ci, ni, { memo: v.trim() })}
                        />
                      </Field>

                      <div className="a-walletrow__foot">
                        <Toggle
                          checked={!!n.manualOnly}
                          onChange={(v) => patchNetwork(ci, ni, { manualOnly: v })}
                          label="Manual only — no watcher, an admin confirms every payment by hand"
                        />
                        <Button size="sm" variant="danger" icon="trash" onClick={() => setConfirming({ ci, ni })}>
                          Remove network
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <footer className="a-walletfoot">
            <Button variant="ghost" size="sm" icon="plus" onClick={() => addNetwork(ci)}>
              <span>Add network to {g.currency || 'this currency'}</span>
            </Button>
          </footer>
        </Card>
      ))}

      <Button
        variant="outline"
        icon="plus"
        onClick={() => {
          edit((gs) => [...gs, { currency: '', name: '', networks: [blankNetwork()] }]);
          setOpen(new Set([key(doc.gateways.length, 0)]));
        }}
      >
        <span>Add currency</span>
      </Button>

      {/* Sticks to the viewport only when there is something to save or report;
          otherwise it is an opaque strip parked over the cards for no reason. */}
      <div className={`a-walletbar${dirty ? ' is-dirty' : ''}${dirty || saved || error ? ' is-live' : ''}`}>
        <span className="a-walletbar__state">
          {error && <span className="at-neg"><Icon name="alert" size={15} /> {error}</span>}
          {!error && dirty && <><span className="a-walletbar__pip" />Unsaved changes — nothing is live until you save.</>}
          {!error && !dirty && saved && <Chip tone="success">Saved — live on the next order</Chip>}
          {!error && !dirty && !saved && <span className="at-muted">No changes.</span>}
        </span>
        {dirty && <Button variant="ghost" onClick={discard}>Discard</Button>}
        <Button
          variant="primary"
          disabled={saving || !dirty || problems.length > 0}
          onClick={save}
        >
          {saving ? 'Saving…' : problems.length ? `Fix ${problems.length} problem${problems.length === 1 ? '' : 's'}` : 'Save wallets'}
        </Button>
      </div>

      {confirming && confirming.ni === null && (
        <Confirm
          title={`Remove ${doc.gateways[confirming.ci]?.currency || 'this currency'}?`}
          message={
            'Every network under it goes too, and buyers stop being offered the currency entirely. '
            + 'Orders already waiting on those addresses keep their invoice but lose their watcher — settle those by hand first.'
          }
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            edit((gs) => gs.filter((_, i) => i !== confirming.ci));
            setOpen(new Set());
            setConfirming(null);
          }}
        />
      )}

      {confirming && confirming.ni !== null && (
        <Confirm
          title="Remove this network?"
          message={
            'Buyers will stop being offered it. Any order already waiting on this address keeps its '
            + 'invoice, but the watcher will no longer poll for it — settle those by hand first.'
          }
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            const { ci, ni } = confirming as { ci: number; ni: number };
            edit((gs) => { gs[ci].networks.splice(ni, 1); return gs; });
            setOpen(new Set());
            setConfirming(null);
          }}
        />
      )}
    </>
  );
}

function Head() {
  return (
    <header className="a-pagehead">
      <div>
        <h1 className="a-pagehead__title">Deposit wallets</h1>
        <p className="a-pagehead__sub">
          Where subscription payments arrive. Saving takes effect on the next order — no restart.
          Every buyer on a network shares one address, so orders are told apart by their exact
          amount; that is why decimals have to be right.
        </p>
      </div>
    </header>
  );
}
