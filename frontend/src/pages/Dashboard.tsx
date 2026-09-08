import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Spinner, EmptyState, Badge } from "../components/ui";
import { formatDate, formatDateTime, isOverdue } from "../lib/format";
import { PRIORITY_COLORS } from "../api/enums";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const { consultant } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard")).data,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Welcome back{consultant ? `, ${consultant.fullName.split(" ")[0]}` : ""}</h1>
          <p className="text-sm text-gray-500">Here's what needs your attention today.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => navigate("/clients?new=1")}>
            + Add client
          </button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Active clients" value={data.stats.activeClientCount} to="/clients" />
            <StatCard label="Overdue follow-ups" value={data.stats.overdueFollowUpCount} to="/follow-ups?scope=overdue" alert={data.stats.overdueFollowUpCount > 0} />
            <StatCard label="Overdue action items" value={data.stats.overdueActionItemCount} alert={data.stats.overdueActionItemCount > 0} />
            <StatCard label="Draft visits" value={data.stats.incompleteDraftCount} alert={data.stats.incompleteDraftCount > 0} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Today & upcoming follow-ups" viewAllTo="/follow-ups">
              {[...data.todayFollowUps, ...data.upcomingFollowUps].length === 0 ? (
                <EmptyState title="No upcoming follow-ups" />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {[...data.todayFollowUps, ...data.upcomingFollowUps].slice(0, 6).map((f: any) => (
                    <li key={f.id}>
                      <Link to={`/clients/${f.client.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
                        <span>
                          <span className="font-medium text-gray-900">{f.client.fullName}</span>{" "}
                          <span className="text-gray-500">— {f.type.replace("_", " ").toLowerCase()}</span>
                        </span>
                        <span className="text-gray-500">{formatDateTime(f.scheduledAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Overdue follow-ups" viewAllTo="/follow-ups?scope=overdue">
              {data.overdueFollowUps.length === 0 ? (
                <EmptyState title="Nothing overdue" description="Great work staying on top of follow-ups." />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.overdueFollowUps.slice(0, 6).map((f: any) => (
                    <li key={f.id}>
                      <Link to={`/clients/${f.client.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
                        <span className="font-medium text-gray-900">{f.client.fullName}</span>
                        <span className="text-red-600">{formatDateTime(f.scheduledAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Incomplete action items">
              {data.incompleteActionItems.length === 0 ? (
                <EmptyState title="No open action items" />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.incompleteActionItems.slice(0, 8).map((a: any) => (
                    <li key={a.id}>
                      <Link to={`/clients/${a.client.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
                        <span className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{a.title}</span>
                          <Badge className={PRIORITY_COLORS[a.priority]}>{a.priority}</Badge>
                        </span>
                        <span className={isOverdue(a.dueDate) ? "font-medium text-red-600" : "text-gray-500"}>{formatDate(a.dueDate)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Recent visits">
              {data.recentVisits.length === 0 ? (
                <EmptyState title="No visits recorded yet" />
              ) : (
                <ul className="divide-y divide-gray-100">
                  {data.recentVisits.map((v: any) => (
                    <li key={v.id}>
                      <Link to={`/visits/${v.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
                        <span className="font-medium text-gray-900">{v.client.fullName}</span>
                        <span className="text-gray-500">{formatDate(v.visitDate)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Recently viewed clients">
              {data.recentlyViewedClients.length === 0 ? (
                <EmptyState title="No clients viewed yet" />
              ) : (
                <ClientMiniList clients={data.recentlyViewedClients} />
              )}
            </Section>
            <Section title="Recently added clients">
              {data.recentlyAddedClients.length === 0 ? (
                <EmptyState title="No clients yet" action={<Link className="btn-primary" to="/clients?new=1">Add your first client</Link>} />
              ) : (
                <ClientMiniList clients={data.recentlyAddedClients} />
              )}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

function ClientMiniList({ clients }: { clients: any[] }) {
  return (
    <ul className="divide-y divide-gray-100">
      {clients.map((c) => (
        <li key={c.id}>
          <Link to={`/clients/${c.id}`} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
            <span className="font-medium text-gray-900">{c.fullName}</span>
            <span className="text-gray-500">{c.phone}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StatCard({ label, value, to, alert }: { label: string; value: number; to?: string; alert?: boolean }) {
  const content = (
    <div className={`card ${alert ? "border-amber-300 bg-amber-50" : ""}`}>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function Section({ title, children, viewAllTo }: { title: string; children: React.ReactNode; viewAllTo?: string }) {
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {viewAllTo && (
          <Link to={viewAllTo} className="text-xs font-medium text-brand-700 hover:underline">
            View all
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
