import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api/client";
import { Modal, ConfirmDialog, Badge } from "../../components/ui";
import ActionItemForm from "../../components/ActionItemForm";
import { ACTION_ITEM_STATUS_COLORS, PRIORITY_COLORS } from "../../api/enums";
import { formatDate, isOverdue } from "../../lib/format";
import type { ActionItem, Baby } from "../../api/types";

interface Props {
  clientId: string;
  visitId: string;
  babies: Baby[];
  actionItems: ActionItem[];
  onChanged: () => void;
}

export default function ActionItemsSection({ clientId, visitId, babies, actionItems, onChanged }: Props) {
  const { t } = useTranslation();
  const [modal, setModal] = useState<{ open: boolean; item?: ActionItem | null }>({ open: false });
  const [deleteTarget, setDeleteTarget] = useState<ActionItem | null>(null);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">{t("actionItemsSection.title")}</h2>
        <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setModal({ open: true })}>
          {t("actionItemsSection.add")}
        </button>
      </div>
      {actionItems.length === 0 ? (
        <p className="text-sm text-gray-500">{t("actionItemsSection.noneRecorded")}</p>
      ) : (
        <ul className="space-y-2">
          {actionItems.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2 rounded-md border border-gray-200 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {a.title} <Badge className={PRIORITY_COLORS[a.priority]}>{t(`enums.priority.${a.priority}`)}</Badge>{" "}
                  <Badge className={ACTION_ITEM_STATUS_COLORS[a.status]}>{t(`enums.actionItemStatus.${a.status}`)}</Badge>
                </p>
                {a.instructions && <p className="mt-0.5 text-sm text-gray-600">{a.instructions}</p>}
                <p className={`mt-0.5 text-xs ${isOverdue(a.dueDate) && a.status !== "COMPLETED" ? "font-medium text-red-600" : "text-gray-500"}`}>
                  {t("actionItemsSection.due", { date: formatDate(a.dueDate) })}
                </p>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => setModal({ open: true, item: a })}>
                  {t("common.edit")}
                </button>
                <button type="button" className="font-medium text-red-600 hover:underline" onClick={() => setDeleteTarget(a)}>
                  {t("common.delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modal.open} onClose={() => setModal({ open: false })} title={modal.item ? t("actionItemsSection.editModalTitle") : t("actionItemsSection.addModalTitle")}>
        <ActionItemForm
          clientId={clientId}
          visitId={visitId}
          babies={babies}
          actionItem={modal.item}
          onCancel={() => setModal({ open: false })}
          onSaved={() => {
            setModal({ open: false });
            onChanged();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("actionItemsSection.deleteConfirmTitle")}
        confirmLabel={t("common.delete")}
        danger
        onConfirm={async () => {
          if (!deleteTarget) return;
          await api.delete(`/action-items/${deleteTarget.id}`);
          setDeleteTarget(null);
          onChanged();
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
