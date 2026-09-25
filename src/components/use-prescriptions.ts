import { useCallback, useEffect, useRef, useState } from 'react';
import {
  prescriptionError,
  type Prescription,
  type Request,
} from './prescription-model';
export function usePrescriptions(
  api: Request,
  report: (error: unknown) => void,
  revision = 0,
) {
  const [rows, setRows] = useState<Prescription[]>([]),
    [detail, setDetail] = useState<Prescription | null>(null),
    [creating, setCreating] = useState(false),
    [filter, setFilter] = useState(''),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [reload, setReload] = useState(0),
    [blocked, setBlocked] = useState(false);
  const mounted = useRef(false),
    lock = useRef(false),
    epoch = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const fail = useCallback(
    (e: unknown) => {
      setError(prescriptionError(e));
      if ((e as { status?: number })?.status === 401) report(e);
    },
    [report],
  );
  useEffect(() => {
    let live = true;
    const generation = epoch.current;
    void Promise.resolve()
      .then(() => {
        if (live) {
          setLoading(true);
          setRows([]);
        }
        return api<Prescription[]>(
          `/me/prescriptions?page=${page}&limit=20${filter ? `&status=${filter}` : ''}`,
        );
      })
      .then((r) => {
        if (live && generation === epoch.current) {
          setRows(r.data);
          setPages(r.meta?.totalPages ?? 1);
        }
      })
      .catch((e) => {
        if (live && generation === epoch.current) fail(e);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [api, filter, page, reload, revision, fail]);
  async function run(work: () => Promise<void>) {
    if (lock.current || !mounted.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      if (mounted.current) fail(e);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function open(id: string) {
    await run(async () => {
      const r = await api<Prescription>(`/me/prescriptions/${id}`);
      if (mounted.current) {
        setDetail(r.data);
        setCreating(false);
        setBlocked(false);
        epoch.current++;
      }
    });
  }
  function list() {
    if (lock.current) return;
    epoch.current++;
    setDetail(null);
    setCreating(false);
    setBlocked(false);
    setError('');
    setReload((n) => n + 1);
  }
  async function create(body: unknown) {
    await run(async () => {
      try {
        const r = await api<Prescription>('/me/prescriptions', 'POST', body);
        if (mounted.current) {
          setDetail(r.data);
          setCreating(false);
          setReload((n) => n + 1);
          setNotice('Draft saved. Review the fields before confirming.');
        }
      } catch (e) {
        if (
          mounted.current &&
          (!(e as { status?: number })?.status ||
            (e as { status: number }).status >= 500)
        ) {
          setBlocked(true);
          setNotice(
            'The save result is uncertain. Return to the list and check for your draft before creating it again.',
          );
        }
        throw e;
      }
    });
  }
  async function mutate(body: unknown, method = 'PATCH') {
    if (!detail || blocked) return;
    await run(async () => {
      try {
        await api(`/me/prescriptions/${detail.id}`, method, body);
        const r = await api<Prescription>(`/me/prescriptions/${detail.id}`);
        if (mounted.current) {
          setDetail(r.data);
          setReload((n) => n + 1);
          setNotice('Prescription updated.');
        }
      } catch (e) {
        if (mounted.current) setBlocked(true);
        throw e;
      }
    });
  }
  async function upload(form: FormData) {
    if (!detail || blocked) return;
    await run(async () => {
      try {
        await api(`/me/prescriptions/${detail.id}/documents`, 'POST', form);
        const r = await api<Prescription>(`/me/prescriptions/${detail.id}`);
        if (mounted.current) {
          setDetail(r.data);
          setNotice(
            'Image attached. No text was extracted; review the medicine fields manually.',
          );
        }
      } catch (e) {
        if (mounted.current) {
          setBlocked(true);
          setNotice(
            'Reload and check the attached pages before retrying. A page may have been saved even if its response was lost.',
          );
        }
        throw e;
      }
    });
  }
  return {
    loading,
    rows,
    detail,
    creating,
    filter,
    page,
    pages,
    busy,
    error,
    notice,
    blocked,
    setError,
    setCreating,
    setFilter,
    setPage,
    list,
    open,
    create,
    mutate,
    upload,
    run,
    api,
  };
}
