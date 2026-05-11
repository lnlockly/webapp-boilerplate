import { useAuthStore } from '../lib/auth-store';

export function OrgSwitcher() {
  const user = useAuthStore((s) => s.user);
  const activeOrgId = useAuthStore((s) => s.activeOrgId);
  const setActiveOrg = useAuthStore((s) => s.setActiveOrg);

  if (!user?.orgs?.length) return null;

  return (
    <label className="flex flex-col gap-1 px-2">
      <span className="text-[11px] uppercase tracking-wide text-zinc-500">Organization</span>
      <select
        value={activeOrgId ?? ''}
        onChange={(e) => setActiveOrg(e.target.value || null)}
        className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {user.orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
