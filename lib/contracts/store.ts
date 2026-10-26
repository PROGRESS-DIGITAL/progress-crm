import { db } from "@/lib/db";
import { SERVICE_LABELS } from "@/lib/format";
import { getSetting, setSetting } from "@/lib/settings";
import { DEFAULT_TEMPLATE_BODY, DEFAULT_TEMPLATE_NAME } from "./default-template";
import { contractValues, fillTemplate, type Party } from "./fields";

// Реквизиты исполнителя (ваши) хранятся одной записью в настройках
export const EXECUTOR_SETTING = "contracts.executor";
const SEEDED_SETTING = "contracts.defaultSeeded";

export async function getExecutor(): Promise<Party | null> {
  const raw = await getSetting(EXECUTOR_SETTING);
  return raw ? (JSON.parse(raw) as Party) : null;
}

export async function saveExecutor(p: Party) {
  await setSetting(EXECUTOR_SETTING, JSON.stringify(p));
}

// Шаблон по умолчанию создаётся один раз: если его удалить, он не вернётся
export async function ensureDefaultTemplate() {
  if (await getSetting(SEEDED_SETTING)) return;
  if ((await db.contractTemplate.count()) === 0) {
    await db.contractTemplate.create({ data: { name: DEFAULT_TEMPLATE_NAME, body: DEFAULT_TEMPLATE_BODY } });
  }
  await setSetting(SEEDED_SETTING, "1");
}

// Следующий номер: на единицу больше самого большого числового номера
export async function nextContractNumber() {
  const rows = await db.contract.findMany({ select: { number: true } });
  const max = Math.max(0, ...rows.map((r) => Number.parseInt(r.number.replace(/\D+/g, ""), 10)).filter(Number.isFinite));
  return String(max + 1);
}

export async function createContract(input: { templateId: string; dealId: string; number: string; date: Date }) {
  const [template, deal, executor] = await Promise.all([
    db.contractTemplate.findUniqueOrThrow({ where: { id: input.templateId } }),
    db.deal.findUniqueOrThrow({ where: { id: input.dealId }, include: { company: true } }),
    getExecutor(),
  ]);
  const { html, missing } = fillTemplate(
    template.body,
    contractValues({
      number: input.number,
      date: input.date,
      client: deal.company,
      executor,
      deal: { title: deal.title, amount: deal.amount, service: SERVICE_LABELS[deal.service] },
    }),
  );
  const contract = await db.contract.create({
    data: {
      number: input.number,
      date: input.date,
      title: template.name,
      body: html,
      templateId: template.id,
      dealId: deal.id,
      companyId: deal.companyId,
    },
  });
  return { contract, missing };
}
