// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ComparePanel } from './ComparePanel';

describe('demo IRSA', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('selecciona recortes y separa la evaluación científica', async () => {
    const observations = ['a', 'b'].map(obs_id => ({obs_id, collection:'spherex_dr1', detector:'D1', date_obs:'2025-01-01', size_bytes:1, sha256:'hash', source_url:'https://irsa.ipac.caltech.edu/example', extensions:[]}));
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/real-data-demo') return {ok:true, status:200, json:async () => ({observations})};
      if (url === '/api/scientific-validation') return {ok:true, status:200, json:async () => ({status:'REVIEW_REQUIRED', criteria:[{name:'spectral', status:'REVIEW_REQUIRED', reason:'calibración pendiente', limitations:[]}]})};
      return {ok:true, status:200, json:async () => ({obs_id_a:'a',obs_id_b:'b',status:'comparable',provenance:'irsa_verified_local',reasons:[],alignment:{status:'ok',detail:'técnica'},diff:{status:'not_implemented',detail:'sin resta',provenance:'stub'},checks:{}})};
    });
    vi.stubGlobal('fetch', fetchMock);
    const container = document.createElement('div'); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {root.render(<ComparePanel />);});
    expect(container.textContent).toContain('Verified local IRSA data');
    const select = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Select both'))!;
    await act(async () => select.click());
    const compare = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Compare via API'))!;
    await act(async () => {compare.click();});
    expect(container.textContent).toContain('Technical result');
    expect(container.textContent).toContain('REVIEW_REQUIRED');
    expect(container.textContent).toContain('calibración pendiente');
    expect(fetchMock).toHaveBeenCalledWith('/api/scientific-validation', expect.objectContaining({method:'POST',body:JSON.stringify({observation_1:'a',observation_2:'b'})}));
    await act(async () => root.unmount()); container.remove();
  });

  it('explica el rechazo del FITS sin afirmar que se validó científicamente', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/real-data-demo') return { ok: true, status: 200, json: async () => ({ observations: [] }) };
      if (url === '/api/scientific-validation') return { ok: false, status: 422, json: async () => ({ detail: 'Invalid FITS image: stub-wise0855-001' }) };
      return { ok: true, status: 200, json: async () => ({ obs_id_a: 'a', obs_id_b: 'b', status: 'not_comparable', provenance: 'stub', reasons: [], alignment: { status: 'failed', detail: 'sin WCS' }, diff: { status: 'skipped', detail: 'sin resta', provenance: 'stub' }, checks: {} }) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const container = document.createElement('div'); document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<ComparePanel preferredIds={['a', 'b']} />); });
    const compare = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Compare via API'))!;
    await act(async () => { compare.click(); });
    expect(container.textContent).toContain('does not contain a compatible scientific image');
    expect(container.textContent).toContain('IMAGE extension');
    expect(container.textContent).toContain('not_comparable');
    expect(container.textContent).not.toContain('Error: HTTP 422');
    await act(async () => root.unmount()); container.remove();
  });
});
