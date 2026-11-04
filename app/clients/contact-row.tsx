"use client";

import { useState } from "react";
import type { FormState } from "@/lib/forms";
import { ConfirmDeleteButton } from "@/components/confirm-delete";
import { ContactForm, type ContactValues } from "./contact-form";

// Контакт в карточке клиента: «Изменить» раскрывает форму прямо в списке
export function ContactRow({
  contact,
  update,
  remove,
}: {
  contact: ContactValues;
  update: (prev: FormState, formData: FormData) => Promise<FormState>;
  remove: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const c = contact;

  if (editing) {
    return (
      <li className="py-4">
        <ContactForm
          action={update}
          initial={c}
          submitLabel="Сохранить"
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 text-sm">
        <button type="button" onClick={() => setEditing(true)} className="text-left font-medium hover:text-blue-700">
          {c.fullName}
        </button>
        {c.position && <span className="text-slate-500"> · {c.position}</span>}
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-slate-600">
          {c.phone && (
            <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="hover:text-blue-700">
              {c.phone}
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="break-all hover:text-blue-700">
              {c.email}
            </a>
          )}
          {!c.phone && !c.email && "Нет телефона и email"}
        </div>
        {c.notes && <p className="mt-0.5 text-xs text-slate-500">{c.notes}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Изменить
        </button>
        <ConfirmDeleteButton action={remove} what={`контакт «${c.fullName}»`} />
      </div>
    </li>
  );
}
