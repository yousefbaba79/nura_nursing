import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { Modal, Spinner, EmptyState, Badge } from "../../components/ui";
import ClientForm from "../../components/ClientForm";
import { CLIENT_STATUSES, CLIENT_STATUS_COLORS, CLIENT_STATUS_LABELS } from "../../api/enums";
import { formatDate } from "../../lib/format";
import type { Client } from "../../api/types";

export default function ClientList() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(params.get("new") === "1");
  const [search, setSearch] = useState(params.get("q") || "");

  const status = params.get("status") || "";
  const sort = params.get("sort") || "name";

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search) next.set("q", search);
      else next.delete("q");
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", { q: params.get("q") || "", status, sort }],
    queryFn: async () =>
      (
        await api.get("/clients", {
          params: { q: params.get("q") || undefined, status: status || undefined, sort },
        })
      ).data.clients as Client[],
  });

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900">Clients</h1>
        <button
          className="btn-primary"
          onClick={() => {
            setShowForm(true);
          }}
        >
          + Add client
        </button>
      </div>

      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className="input sm:max-w-xs"
          placeholder="Search name, phone, email, baby…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search clients"
        />
        <select className="input sm:max-w-[200px]" value={status} onChange={(e) => setParam("status", e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLIENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="input sm:max-w-[220px]" value={sort} onChange={(e) => setParam("sort", e.target.value)} aria-label="Sort clients">
          <option value="name">Name (A–Z)</option>
          <option value="recent_added">Most recently added</option>
          <option value="recent_updated">Most recently updated</option>
          <option value="last_visit">Last visit</option>
          <option value="next_follow_up">Next follow-up</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="No clients found" description="Try adjusting your search or filters, or add a new client." />
      ) : (
        <div className="card overflow-hidden !p-0">
          <ul className="divide-y divide-gray-100">
            {data.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/clients/${c.id}`)}
                  className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{c.fullName}</p>
                    <p className="text-sm text-gray-500">
                      {c.phone}
                      {c.email ? ` · ${c.email}` : ""}
                      {c.babies && c.babies.length > 0 ? ` · ${c.babies.map((b) => b.fullName).join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    {c.openActionItemCount ? (
                      <Badge className="bg-amber-100 text-amber-800">{c.openActionItemCount} open task{c.openActionItemCount === 1 ? "" : "s"}</Badge>
                    ) : null}
                    <span className="text-gray-500">Last visit: {formatDate(c.lastVisitDate)}</span>
                    <Badge className={CLIENT_STATUS_COLORS[c.status]}>{CLIENT_STATUS_LABELS[c.status]}</Badge>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add client" wide>
        <ClientForm
          onCancel={() => setShowForm(false)}
          onSaved={(client) => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ["clients"] });
            navigate(`/clients/${client.id}`);
          }}
        />
      </Modal>
    </div>
  );
}
