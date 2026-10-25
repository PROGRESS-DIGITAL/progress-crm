"use client";

import { useActionState, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { AvatarCropper } from "@/components/avatar-cropper";
import { Field, inputClass, primaryButton } from "@/components/field";
import { fieldValue, type FormState } from "@/lib/forms";
import { saveProfile } from "./actions";

export const MESSENGERS = [
  { name: "telegram", label: "Telegram", placeholder: "@username" },
  { name: "max", label: "Max", placeholder: "+7 900 000-00-00" },
  { name: "vk", label: "VK", placeholder: "vk.com/username" },
  { name: "instagram", label: "Instagram", placeholder: "@username" },
  { name: "whatsapp", label: "WhatsApp", placeholder: "+7 900 000-00-00" },
] as const;

type Messenger = (typeof MESSENGERS)[number]["name"];

type Profile = {
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  avatar: string | null;
} & Record<Messenger, string | null>;

export function ProfileForm({ initial }: { initial: Profile }) {
  const [state, formAction, pending] = useActionState(saveProfile, undefined);
  const v = (name: string) => fieldValue(state, initial, name);
  const err = state?.errors ?? {};
  const [avatar, setAvatar] = useState(initial.avatar);
  const [avatarField, setAvatarField] = useState("keep");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initial.name);
  // Исходное фото держим, пока открыта страница: кадр можно поправить ещё раз без новой загрузки
  const [source, setSource] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="flex items-center gap-4 sm:col-span-2">
        <Avatar name={name} src={avatar} size={72} />
        <div className="flex flex-col items-start gap-1">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            >
              {avatar ? "Сменить фото" : "Загрузить фото"}
            </button>
            {source && (
              <button
                type="button"
                onClick={() => setCropping(true)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Изменить кадр
              </button>
            )}
            {avatar && (
              <button
                type="button"
                onClick={() => {
                  setSource(null);
                  setAvatar(null);
                  setAvatarField("");
                }}
                className="text-sm text-slate-500 hover:text-rose-600"
              >
                Удалить
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">JPG или PNG, кадр в круге выберете сами</p>
          {(photoError || err.avatar) && <p className="text-xs text-rose-600">{photoError || err.avatar}</p>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Фото"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setPhotoError(null);
            const reader = new FileReader();
            reader.onload = () => {
              setSource(reader.result as string);
              setCropping(true);
            };
            reader.onerror = () => setPhotoError("Не удалось прочитать файл, попробуйте другое фото");
            reader.readAsDataURL(file);
          }}
        />
        {cropping && source && (
          <AvatarCropper
            src={source}
            onCancel={() => setCropping(false)}
            onDone={(data) => {
              setAvatar(data);
              setAvatarField(data);
              setCropping(false);
            }}
          />
        )}
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
      <h2 className="mt-2 font-semibold sm:col-span-2">Мессенджеры</h2>
      {MESSENGERS.map((m) => (
        <Field key={m.name} label={m.label} error={err[m.name]}>
          <input name={m.name} defaultValue={v(m.name)} placeholder={m.placeholder} className={inputClass} />
        </Field>
      ))}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Сохраняю…" : "Сохранить"}
        </button>
        {state?.saved && !pending && <span className="text-sm text-emerald-600">Сохранено</span>}
      </div>
    </form>
  );
}
