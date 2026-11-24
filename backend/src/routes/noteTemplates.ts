import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../types";
import { recordAudit } from "../lib/audit";
import { authenticate } from "../middleware/auth";

const app = new Hono<AppEnv>();
app.use(authenticate);

const noteTemplateInput = z.object({
  label: z.string().min(1, "Label is required."),
  text: z.string().min(1, "Text is required."),
});

// GET /api/note-templates
app.get("/", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const noteTemplates = await prisma.noteTemplate.findMany({
    where: { consultantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return c.json({ noteTemplates });
});

app.post("/", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const parsed = noteTemplateInput.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields.", details: parsed.error.flatten() }, 400);

  const last = await prisma.noteTemplate.findFirst({
    where: { consultantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const noteTemplate = await prisma.noteTemplate.create({
    data: { consultantId, label: parsed.data.label, text: parsed.data.text, sortOrder: (last?.sortOrder ?? -1) + 1 },
  });
  await recordAudit(prisma, { consultantId, action: "NOTE_TEMPLATE_CREATED", entityType: "NoteTemplate", entityId: noteTemplate.id });
  return c.json({ noteTemplate }, 201);
});

// PUT /api/note-templates/reorder  { ids: string[] } — full ordered list of the consultant's template ids
app.put("/reorder", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const parsed = z.object({ ids: z.array(z.string().min(1)).min(1) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Invalid order." }, 400);

  const ids = parsed.data.ids;
  const owned = await prisma.noteTemplate.findMany({ where: { consultantId }, select: { id: true } });
  const ownedIds = new Set(owned.map((t) => t.id));
  if (new Set(ids).size !== ids.length || ids.length !== ownedIds.size || !ids.every((id) => ownedIds.has(id))) {
    return c.json({ error: "The template list has changed. Please refresh and try again." }, 409);
  }

  await prisma.$transaction(
    ids.map((id, index) => prisma.noteTemplate.update({ where: { id }, data: { sortOrder: index } })),
  );
  await recordAudit(prisma, { consultantId, action: "NOTE_TEMPLATES_REORDERED", entityType: "NoteTemplate" });

  const noteTemplates = await prisma.noteTemplate.findMany({
    where: { consultantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return c.json({ noteTemplates });
});

app.put("/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await prisma.noteTemplate.findFirst({ where: { id: c.req.param("id"), consultantId } });
  if (!existing) return c.json({ error: "Template not found." }, 404);

  const parsed = noteTemplateInput.partial().safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "Please check the highlighted fields." }, 400);

  const noteTemplate = await prisma.noteTemplate.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.text !== undefined ? { text: parsed.data.text } : {}),
    },
  });
  await recordAudit(prisma, { consultantId, action: "NOTE_TEMPLATE_UPDATED", entityType: "NoteTemplate", entityId: noteTemplate.id });
  return c.json({ noteTemplate });
});

app.delete("/:id", async (c) => {
  const prisma = c.get("prisma");
  const consultantId = c.get("consultantId")!;
  const existing = await prisma.noteTemplate.findFirst({ where: { id: c.req.param("id"), consultantId } });
  if (!existing) return c.json({ error: "Template not found." }, 404);

  await prisma.noteTemplate.delete({ where: { id: existing.id } });
  await recordAudit(prisma, { consultantId, action: "NOTE_TEMPLATE_DELETED", entityType: "NoteTemplate", entityId: existing.id });
  return c.json({ ok: true });
});

export default app;
