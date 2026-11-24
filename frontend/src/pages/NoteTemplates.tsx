import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, apiErrorMessage } from "../api/client";
import { Modal, ConfirmDialog, Spinner, EmptyState, ErrorBanner } from "../components/ui";
import type { NoteTemplate } from "../api/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "./noteTemplatesDnd";
import { CSS } from "@dnd-kit/utilities";

export default function NoteTemplates() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; item?: NoteTemplate | null }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<NoteTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["note-templates"],
    queryFn: async () => (await api.get("/note-templates")).data.noteTemplates as NoteTemplate[],
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!data || !over || active.id === over.id) return;
    const oldIndex = data.findIndex((nt) => nt.id === active.id);
    const newIndex = data.findIndex((nt) => nt.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(data, oldIndex, newIndex);
    const previous = data;
    queryClient.setQueryData(["note-templates"], reordered);
    setDeleteError("");
    try {
      const res = await api.put("/note-templates/reorder", { ids: reordered.map((nt) => nt.id) });
      queryClient.setQueryData(["note-templates"], res.data.noteTemplates as NoteTemplate[]);
    } catch (err) {
      queryClient.setQueryData(["note-templates"], previous);
      setDeleteError(apiErrorMessage(err, t("noteTemplates.couldNotReorder")));
      invalidate();
    }
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["note-templates"] });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api.delete(`/note-templates/${deleteTarget.id}`);
      setDeleteTarget(null);
      invalidate();
    } catch (err) {
      setDeleteError(apiErrorMessage(err, t("noteTemplates.couldNotDelete")));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Link to="/settings" className="text-sm font-medium text-brand-700 hover:underline">
          {t("noteTemplates.backToSettings")}
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t("noteTemplates.title")}</h1>
            <p className="text-sm text-gray-500">{t("noteTemplates.subtitle")}</p>
          </div>
          <button className="btn-primary" onClick={() => setModal({ open: true })}>
            {t("noteTemplates.add")}
          </button>
        </div>
      </div>

      <ErrorBanner message={deleteError} />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title={t("noteTemplates.noneYet")} description={t("noteTemplates.noneYetDescription")} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
          <SortableContext items={data.map((nt) => nt.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {data.map((item) => (
                <SortableTemplateItem
                  key={item.id}
                  item={item}
                  onEdit={() => setModal({ open: true, item })}
                  onDelete={() => setDeleteTarget(item)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        title={modal.item ? t("noteTemplates.editModalTitle") : t("noteTemplates.addModalTitle")}
      >
        <NoteTemplateForm
          noteTemplate={modal.item}
          onCancel={() => setModal({ open: false })}
          onSaved={() => {
            setModal({ open: false });
            invalidate();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("noteTemplates.deleteConfirmTitle")}
        confirmLabel={t("common.delete")}
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function SortableTemplateItem({
  item,
  onEdit,
  onDelete,
}: {
  item: NoteTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`card flex items-start gap-3 ${isDragging ? "relative z-10 shadow-lg ring-2 ring-brand-300" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        title={t("noteTemplates.dragToReorder")}
        aria-label={t("noteTemplates.dragToReorder")}
        className="-my-1 shrink-0 cursor-grab touch-none rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:cursor-grabbing"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <circle cx="7" cy="5" r="1.5" />
          <circle cx="13" cy="5" r="1.5" />
          <circle cx="7" cy="10" r="1.5" />
          <circle cx="13" cy="10" r="1.5" />
          <circle cx="7" cy="15" r="1.5" />
          <circle cx="13" cy="15" r="1.5" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900">{item.label}</p>
        <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-600">{item.text}</p>
      </div>
      <div className="flex shrink-0 gap-2 text-xs">
        <button type="button" className="font-medium text-brand-700 hover:underline" onClick={onEdit}>
          {t("common.edit")}
        </button>
        <button type="button" className="font-medium text-red-600 hover:underline" onClick={onDelete}>
          {t("common.delete")}
        </button>
      </div>
    </li>
  );
}

function NoteTemplateForm({
  noteTemplate,
  onSaved,
  onCancel,
}: {
  noteTemplate?: NoteTemplate | null;
  onSaved: (item: NoteTemplate) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(noteTemplate?.label || "");
  const [text, setText] = useState(noteTemplate?.text || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !text.trim()) {
      setError(t("noteTemplates.errorFieldsRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { label, text };
      const res = noteTemplate
        ? await api.put(`/note-templates/${noteTemplate.id}`, payload)
        : await api.post("/note-templates", payload);
      onSaved(res.data.noteTemplate);
    } catch (err) {
      setError(apiErrorMessage(err, t("noteTemplates.couldNotSave")));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorBanner message={error} />
      <div>
        <label className="label" htmlFor="nt-label">{t("noteTemplates.labelField")}</label>
        <input id="nt-label" className="input" value={label} onChange={(e) => setLabel(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="nt-text">{t("noteTemplates.textField")}</label>
        <textarea id="nt-text" className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} required />
      </div>
      <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? t("common.saving") : noteTemplate ? t("common.saveChanges") : t("noteTemplates.addTemplate")}
        </button>
      </div>
    </form>
  );
}
