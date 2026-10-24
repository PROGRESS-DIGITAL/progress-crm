"use client";

import { useActionState, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { Field, inputClass, primaryButton } from "@/components/field";
import { fieldValue, type FormState } from "@/lib/forms";
import { saveProfile } from "./actions";

type Profile = { name: string; position: string | null; phone: string | null; email: string | null; avatar: string | null };

const AVATAR_PX = 256;

// Фото обрезается по центру в квадрат и сжимается, чтобы в базе лежало несколько десятков килобайт
async function toAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_PX;
  canvas
    .getContext("2d")!
    .drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ProfileForm({ initial }: { initial: Profile }) {
  const [state, formAction, pending] = useActionState(saveProfile, undefined);
  const v = (name: string) => fieldValue(state, initial, name);
  const err = state?.errors ?? {};
  const [avatar, setAvatar] = useState(initial.avatar);
  const [avatarField, setAvatarField] = useState("keep");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="flex items-center gap-4 sm:col-span-2">
        <Avatar name={name} src={avatar} size={72} />
        <div className="flex flex-col items-start gap-1">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              {avatar ? "Сменить фото" : "Загрузить фото"}
            </button>
            {avatar && (
              <button
                type="button"
                onClick={() => {
                  setAvatar(null);
                  setAvatarField("");
                }}
                className="text-sm text-slate-500 hover:text-rose-600"
              >
                Удалить
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">JPG или PNG, обрежется по кругу</p>
          {(photoError || err.avatar) && <p className="text-xs text-rose-600">{photoError || err.avatar}</p>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Фото"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setPhotoError(null);
            try {
              const data = await toAvatar(file);
              setAvatar(data);
              setAvatarField(data);
            } catch {
              setPhotoError("Не удалось прочитать файл, попробуйте другое фото");
            }
          }}
        />
        <input type="hidden" name="avatar" value={avatarField} />
      </div>
      <Field label="Имя" error={err.name}>
        <input
          name="name"
          defaultValue={v("name")}
          onChange={(e) => setName(e.target.value)}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Должность" error={err.position}>
        <input name="position" defaultValue={v("position")} className={inputClass} />
      </Field>
      <Field label="Телефон" error={err.phone}>
        <input name="phone" type="tel" defaultValue={v("phone")} className={inputClass} />
      </Field>
      <Field label="Email" error={err.email}>
        <input name="email" type="email" defaultValue={v("email")} className={inputClass} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        {state?.saved && !pending && <span className="text-sm text-emerald-600">Сохранено</span>}
      </div>
    </form>
  );
}
