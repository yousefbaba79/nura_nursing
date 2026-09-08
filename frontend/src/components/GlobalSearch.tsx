import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

interface ClientResult {
  id: string;
  fullName: string;
  phone: string;
  status: string;
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const res = await api.get("/clients", { params: { q: query, includeArchived: "true" } });
        setResults(res.data.clients.slice(0, 8));
        setOpen(true);
      } catch {
        // ignore
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Search clients, phone, baby name…"
        aria-label="Search clients"
        className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setOpen(false);
                setQuery("");
                navigate(`/clients/${c.id}`);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">{c.fullName}</span>
              <span className="text-gray-500">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
