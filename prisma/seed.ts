import { PrismaClient, StageKind, Service } from "@prisma/client";

const prisma = new PrismaClient();

const stages: { name: string; kind: StageKind }[] = [
  { name: "Новая", kind: "OPEN" },
  { name: "Квалификация", kind: "OPEN" },
  { name: "КП отправлено", kind: "OPEN" },
  { name: "Подготовка документов", kind: "OPEN" },
  { name: "Счет на оплату", kind: "OPEN" },
  { name: "В работе", kind: "OPEN" },
  { name: "Релиз и финальный счет", kind: "OPEN" },
  { name: "Оплачен", kind: "WON" },
  { name: "Проиграна", kind: "LOST" },
];

const demoDeals: {
  title: string;
  clientName: string;
  amount: number;
  service: Service;
  stage: number;
  owner: string;
}[] = [
  { title: "Сайт для стоматологии", clientName: "Дент-Мастер", amount: 180000, service: "WEBSITE", stage: 0, owner: "Илья" },
  { title: "SEO на 6 месяцев", clientName: "СтройГрад", amount: 360000, service: "SEO", stage: 1, owner: "Илья" },
  { title: "Яндекс Директ, запуск", clientName: "Кофейня «Зерно»", amount: 45000, service: "CONTEXT_ADS", stage: 2, owner: "Илья" },
  { title: "Логотип и фирменный стиль", clientName: "Эко-Ферма", amount: 120000, service: "BRANDING", stage: 3, owner: "Илья" },
];

async function main() {
  if ((await prisma.stage.count()) > 0) {
    console.log("Этапы уже есть, пропускаю сид");
    return;
  }
  const created = [];
  for (const [i, s] of stages.entries()) {
    created.push(await prisma.stage.create({ data: { ...s, order: i } }));
  }
  if (process.env.SEED_DEMO !== "0") {
    for (const [i, d] of demoDeals.entries()) {
      const { stage, clientName, ...rest } = d;
      const company = await prisma.company.create({ data: { name: clientName } });
      await prisma.deal.create({
        data: { ...rest, companyId: company.id, stageId: created[stage].id, position: i },
      });
    }
  }
  console.log(`Создано этапов: ${created.length}`);
}

main().finally(() => prisma.$disconnect());
