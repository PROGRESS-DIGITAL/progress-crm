import type { PrismaClient, Service, Stage } from "@prisma/client";

// Вымышленные данные для демо-версии CRM (DEMO_MODE=1): клиенты, сделки за год, лиды, задачи, переписки.
// Даты считаются от сегодняшнего дня, поэтому после еженедельного сброса дашборд и календарь выглядят свежими.
// Ни одного настоящего клиента здесь нет: телефоны вида +7 900 000-xx-xx, почта на example.ru

const DAY = 86_400_000;

function daysFromNow(days: number, hour = 12, minute = 0) {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const DEMO_OWNER_NAME = "Гость";

const MANAGERS = ["Анна Смирнова", "Максим Орлов"];

const COMPANIES = [
  { key: "dent", name: "Стоматология «Дент-Мастер»", city: "Казань", contact: "Елена Воронина", position: "Главный врач", situation: "hasLogo" },
  { key: "stroy", name: "СтройГрад", city: "Екатеринбург", contact: "Игорь Кузнецов", position: "Коммерческий директор", situation: "hasSite" },
  { key: "coffee", name: "Кофейня «Зерно»", city: "Самара", contact: "Дарья Белова", position: "Владелец", situation: "noLogo" },
  { key: "farm", name: "Эко-Ферма «Луговая»", city: "Тула", contact: "Сергей Полев", position: "Директор", situation: "idea" },
  { key: "garage", name: "Автосервис «Гараж 24»", city: "Новосибирск", contact: "Артём Ключев", position: "Управляющий", situation: "hasLogo" },
  { key: "fitness", name: "Фитнес-клуб «Пульс»", city: "Краснодар", contact: "Марина Лёвина", position: "Маркетолог", situation: "hasSite" },
  { key: "law", name: "Юридическая фирма «Право и Дело»", city: "Москва", contact: "Павел Строгов", position: "Партнёр", situation: "hasLogo" },
  { key: "bakery", name: "Пекарня «Хлебный дом»", city: "Пермь", contact: "Ольга Мякишева", position: "Совладелец", situation: "noLogo" },
  { key: "furniture", name: "Мебельная фабрика «Дубрава»", city: "Воронеж", contact: "Виктор Столяров", position: "Генеральный директор", situation: "hasSite" },
  { key: "clinic", name: "Клиника «Здоровье+»", city: "Нижний Новгород", contact: "Наталья Добрая", position: "Администратор", situation: "complex" },
  { key: "logistic", name: "ТК «Северный путь»", city: "Санкт-Петербург", contact: "Андрей Возов", position: "Руководитель отдела продаж", situation: "hasSite" },
  { key: "beauty", name: "Салон красоты «Лаванда»", city: "Ростов-на-Дону", contact: "Кристина Цветкова", position: "Владелец", situation: "noLogo" },
] as const;

type CompanyKey = (typeof COMPANIES)[number]["key"];

type DemoDeal = {
  title: string;
  company: CompanyKey;
  amount: number;
  service: Service;
  salesStep: string;
  product?: string;
  owner: string;
  // Индекс этапа воронки: 0–6 открытые, 7 — оплачен, 8 — проиграна
  stage: number;
  // Для оплаченных и проигранных: сколько дней назад закрыта
  closedDaysAgo?: number;
  startDaysAgo: number;
  lostReason?: string;
  notes?: string;
};

const [ANNA, MAX] = MANAGERS;

const DEALS: DemoDeal[] = [
  // Оплаченные за последний год: из них строятся дашборд, LTV и отчёт по менеджерам
  { title: "Логотип", company: "coffee", amount: 80000, service: "BRANDING", salesStep: "logo", product: "Логотип", owner: ANNA, stage: 7, closedDaysAgo: 340, startDaysAgo: 370 },
  { title: "Бизнес-сайт", company: "dent", amount: 250000, service: "WEBSITE", salesStep: "businessSite", product: "Бизнес-сайт", owner: MAX, stage: 7, closedDaysAgo: 300, startDaysAgo: 350 },
  { title: "Корпоративный сайт", company: "stroy", amount: 320000, service: "WEBSITE", salesStep: "corporateSite", product: "Корпоративный сайт", owner: ANNA, stage: 7, closedDaysAgo: 270, startDaysAgo: 330 },
  { title: "Брендбук", company: "law", amount: 150000, service: "BRANDING", salesStep: "brandbook", product: "Брендбук", owner: MAX, stage: 7, closedDaysAgo: 240, startDaysAgo: 280 },
  { title: "Интернет-магазин", company: "furniture", amount: 450000, service: "WEBSITE", salesStep: "shop", product: "Интернет-магазин", owner: ANNA, stage: 7, closedDaysAgo: 200, startDaysAgo: 280 },
  { title: "SEO, 3 месяца", company: "stroy", amount: 120000, service: "SEO", salesStep: "seo", owner: ANNA, stage: 7, closedDaysAgo: 180, startDaysAgo: 200 },
  { title: "Лендинг для акции", company: "fitness", amount: 150000, service: "WEBSITE", salesStep: "landing", product: "Одностраничный сайт (лендинг)", owner: MAX, stage: 7, closedDaysAgo: 150, startDaysAgo: 175 },
  { title: "Яндекс Директ, запуск", company: "garage", amount: 45000, service: "CONTEXT_ADS", salesStep: "context", owner: MAX, stage: 7, closedDaysAgo: 120, startDaysAgo: 130 },
  { title: "Логотип и логобук", company: "bakery", amount: 130000, service: "BRANDING", salesStep: "logo", product: "Логотип", owner: ANNA, stage: 7, closedDaysAgo: 95, startDaysAgo: 125 },
  { title: "Сайт клиники", company: "clinic", amount: 380000, service: "WEBSITE", salesStep: "corporateSite", product: "Корпоративный сайт", owner: MAX, stage: 7, closedDaysAgo: 70, startDaysAgo: 120 },
  { title: "Бизнес-сайт", company: "coffee", amount: 250000, service: "WEBSITE", salesStep: "businessSite", product: "Бизнес-сайт", owner: ANNA, stage: 7, closedDaysAgo: 45, startDaysAgo: 80 },
  { title: "SEO, 3 месяца", company: "dent", amount: 105000, service: "SEO", salesStep: "seo", owner: MAX, stage: 7, closedDaysAgo: 20, startDaysAgo: 40 },
  { title: "Презентация для инвесторов", company: "logistic", amount: 70000, service: "OTHER", salesStep: "research", owner: ANNA, stage: 7, closedDaysAgo: 6, startDaysAgo: 25 },
  { title: "Яндекс Директ, ведение", company: "fitness", amount: 60000, service: "CONTEXT_ADS", salesStep: "context", owner: MAX, stage: 7, closedDaysAgo: 2, startDaysAgo: 15 },

  // Проигранные
  { title: "Интернет-магазин", company: "beauty", amount: 400000, service: "WEBSITE", salesStep: "shop", owner: ANNA, stage: 8, closedDaysAgo: 160, startDaysAgo: 190, lostReason: "Выбрали шаблон на конструкторе" },
  { title: "SMM на полгода", company: "garage", amount: 180000, service: "SMM", salesStep: "promotion", owner: MAX, stage: 8, closedDaysAgo: 60, startDaysAgo: 80, lostReason: "Отложили до следующего года" },
  { title: "Нейминг и логотип", company: "farm", amount: 140000, service: "BRANDING", salesStep: "naming", owner: ANNA, stage: 8, closedDaysAgo: 12, startDaysAgo: 40, lostReason: "Дорого" },

  // В работе: канбан-воронка
  { title: "Нейминг и логотип", company: "farm", amount: 120000, service: "BRANDING", salesStep: "logo", product: "Логотип", owner: ANNA, stage: 0, startDaysAgo: 1, notes: "Пришёл повторно после отказа, бюджет согласован" },
  { title: "Лендинг для салона", company: "beauty", amount: 150000, service: "WEBSITE", salesStep: "landing", product: "Одностраничный сайт (лендинг)", owner: MAX, stage: 0, startDaysAgo: 2 },
  { title: "SEO на 6 месяцев", company: "furniture", amount: 360000, service: "SEO", salesStep: "seo", owner: ANNA, stage: 1, startDaysAgo: 5 },
  { title: "Редизайн сайта", company: "law", amount: 300000, service: "WEBSITE", salesStep: "corporateSite", product: "Корпоративный сайт", owner: MAX, stage: 1, startDaysAgo: 9 },
  { title: "Яндекс Директ, запуск", company: "bakery", amount: 45000, service: "CONTEXT_ADS", salesStep: "context", owner: ANNA, stage: 2, startDaysAgo: 12, notes: "КП отправлено, ждём ответа до пятницы" },
  { title: "Корпоративный сайт", company: "logistic", amount: 420000, service: "WEBSITE", salesStep: "corporateSite", product: "Корпоративный сайт", owner: MAX, stage: 2, startDaysAgo: 14 },
  { title: "Брендбук", company: "coffee", amount: 150000, service: "BRANDING", salesStep: "brandbook", product: "Брендбук", owner: ANNA, stage: 3, startDaysAgo: 18 },
  { title: "Сайт автосервиса", company: "garage", amount: 250000, service: "WEBSITE", salesStep: "businessSite", product: "Бизнес-сайт", owner: MAX, stage: 4, startDaysAgo: 21 },
  { title: "Онлайн-запись для клиники", company: "clinic", amount: 550000, service: "WEBSITE", salesStep: "service", product: "Сервис", owner: ANNA, stage: 5, startDaysAgo: 35 },
  { title: "Интернет-магазин", company: "dent", amount: 300000, service: "WEBSITE", salesStep: "shop", product: "Интернет-магазин", owner: MAX, stage: 5, startDaysAgo: 28 },
  { title: "Мобильная версия сайта", company: "stroy", amount: 90000, service: "WEBSITE", salesStep: "promotion", owner: ANNA, stage: 6, startDaysAgo: 42 },
];

const LEADS = [
  { name: "Роман Гусев", phone: "+7 900 000-11-01", email: "roman@example.ru", companyName: "Студия йоги «Асана»", message: "Нужен сайт с расписанием и онлайн-оплатой абонементов", formName: "Заявка на сайт", utmSource: "yandex", utmMedium: "cpc", utmCampaign: "sites_brand", status: "NEW", daysAgo: 0 },
  { name: "Татьяна Ермолова", phone: "+7 900 000-11-02", email: "t.ermolova@example.ru", companyName: "Цветочный магазин «Пион»", message: "Хотим логотип и вывеску, открываемся через месяц", formName: "Брендинг", utmSource: "google", utmMedium: "organic", utmCampaign: null, status: "NEW", daysAgo: 1 },
  { name: "Денис Шубин", phone: "+7 900 000-11-03", email: null, companyName: "ООО «ТехноСнаб»", message: "Сколько стоит продвижение в Яндексе?", formName: "Обратный звонок", utmSource: "yandex", utmMedium: "cpc", utmCampaign: "seo", status: "NEW", daysAgo: 1 },
  { name: "Алина Морозова", phone: "+7 900 000-11-04", email: "alina@example.ru", companyName: "Детский центр «Солнышко»", message: "Нужен лендинг для летнего лагеря", formName: "Заявка на сайт", utmSource: "vk", utmMedium: "social", utmCampaign: "summer", status: "IN_PROGRESS", daysAgo: 3 },
  { name: "Олег Литвинов", phone: "+7 900 000-11-05", email: "oleg@example.ru", companyName: "Строительная компания «Опора»", message: "Интересует редизайн и SEO", formName: "Заявка на сайт", utmSource: "yandex", utmMedium: "cpc", utmCampaign: "sites_brand", status: "IN_PROGRESS", daysAgo: 4 },
  { name: "Ксения Рябова", phone: "+7 900 000-11-06", email: null, companyName: null, message: "Ищу дизайнера для визиток", formName: "Обратный звонок", utmSource: null, utmMedium: null, utmCampaign: null, status: "REJECTED", daysAgo: 8 },
] as const;

export async function seedDemo(prisma: PrismaClient, stages: Stage[]) {
  // Сотрудники: гость — директор демо-версии, видит все разделы; менеджеры и дизайнер — без входа, для отчётов и задач
  const guest = await prisma.employee.create({
    data: { name: DEMO_OWNER_NAME, position: "Директор (демо)", isOwner: true, login: "demo" },
  });
  const anna = await prisma.employee.create({
    data: { name: ANNA, position: "Менеджер проектов", roleId: "role_manager", phone: "+7 900 000-00-01", email: "anna@example.ru" },
  });
  const max = await prisma.employee.create({
    data: { name: MAX, position: "Менеджер по продажам", roleId: "role_manager", phone: "+7 900 000-00-02", email: "max@example.ru" },
  });
  const olga = await prisma.employee.create({
    data: { name: "Ольга Кравец", position: "Дизайнер", roleId: "role_designer", email: "olga@example.ru" },
  });

  const companies = new Map<CompanyKey, { id: string; contactId: string }>();
  for (const [i, c] of COMPANIES.entries()) {
    const n = String(i + 10).padStart(2, "0");
    const company = await prisma.company.create({
      data: {
        name: c.name,
        phone: `+7 900 000-${n}-00`,
        email: `info@${c.key}.example.ru`,
        website: `https://${c.key}.example.ru`,
        address: `г. ${c.city}`,
        // Вымышленный ИНН: по нему поступления из банка сопоставляются со счетами
        inn: `77000000${n}`,
        situation: c.situation,
        notes: i % 3 === 0 ? "Постоянный клиент, решения принимает быстро" : null,
        createdAt: daysFromNow(-380 + i * 20),
        contacts: {
          create: [
            { fullName: c.contact, position: c.position, phone: `+7 900 000-${n}-01`, email: `${c.key}@example.ru` },
            ...(i % 2 === 0 ? [{ fullName: "Бухгалтерия", position: "Бухгалтер", email: `buh@${c.key}.example.ru` }] : []),
          ],
        },
      },
      include: { contacts: true },
    });
    companies.set(c.key, { id: company.id, contactId: company.contacts[0].id });
  }

  const products = await prisma.product.findMany({ select: { id: true, name: true } });
  const productId = (name?: string) => (name ? products.find((p) => p.name === name)?.id : undefined);

  const deals: { id: string; title: string; company: CompanyKey; stage: number; amount: number; closedAt: Date | null }[] = [];
  const positions = new Map<number, number>();
  for (const d of DEALS) {
    const stage = stages[d.stage];
    const position = positions.get(d.stage) ?? 0;
    positions.set(d.stage, position + 1);
    const c = companies.get(d.company)!;
    const closedAt = d.closedDaysAgo !== undefined ? daysFromNow(-d.closedDaysAgo) : null;
    const deal = await prisma.deal.create({
      data: {
        title: d.title,
        companyId: c.id,
        contactId: c.contactId,
        productId: productId(d.product),
        amount: d.amount,
        service: d.service,
        salesStep: d.salesStep,
        owner: d.owner,
        stageId: stage.id,
        position,
        startDate: daysFromNow(-d.startDaysAgo),
        createdAt: daysFromNow(-d.startDaysAgo),
        expectedCloseDate: stage.kind === "OPEN" ? daysFromNow(10 + position * 7) : null,
        closedAt,
        lostReason: d.lostReason,
        notes: d.notes,
      },
    });
    deals.push({ id: deal.id, title: d.title, company: d.company, stage: d.stage, amount: d.amount, closedAt });
  }

  // Счета по оплаченным сделкам: нумерация по году, как в «Финансах»
  const seqByYear = new Map<number, number>();
  const paidInvoices: { id: string; seq: number; date: Date; amount: number; paidAt: Date; company: CompanyKey }[] = [];
  for (const d of deals.filter((x) => x.stage === 7 && x.closedAt)) {
    const date = new Date(d.closedAt!.getTime() - 5 * DAY);
    const year = date.getFullYear();
    const seq = (seqByYear.get(year) ?? 0) + 1;
    seqByYear.set(year, seq);
    const invoice = await prisma.document.create({
      data: {
        kind: "INVOICE",
        year,
        seq,
        date,
        amount: d.amount,
        title: d.title,
        dealId: d.id,
        companyId: companies.get(d.company)!.id,
        status: "PAID",
        paidAt: d.closedAt,
      },
    });
    paidInvoices.push({ id: invoice.id, seq, date, amount: d.amount, paidAt: d.closedAt!, company: d.company });
  }
  // Счёт по сделке на этапе «Счет на оплату» ещё не оплачен
  const awaiting = deals.find((d) => d.stage === 4);
  if (awaiting) {
    const date = daysFromNow(-3);
    const year = date.getFullYear();
    await prisma.document.create({
      data: {
        kind: "INVOICE",
        year,
        seq: (seqByYear.get(year) ?? 0) + 1,
        date,
        amount: awaiting.amount / 2,
        title: `${awaiting.title}, предоплата 50%`,
        dealId: awaiting.id,
        companyId: companies.get(awaiting.company)!.id,
      },
    });
  }

  await seedDemoBank(prisma, paidInvoices);

  for (const l of LEADS) {
    const { daysAgo, status, ...data } = l;
    await prisma.lead.create({
      data: {
        ...data,
        status,
        source: "TILDA",
        pageUrl: "https://example.ru/",
        owner: status === "NEW" ? null : ANNA,
        rejectReason: status === "REJECTED" ? "Не наш профиль" : null,
        createdAt: daysFromNow(-daysAgo, 10 + daysAgo, 15),
      },
    });
  }

  // Задачи и встречи: часть на доске, одна просрочена, чтобы было видно напоминание
  const dealByTitle = (title: string, company: CompanyKey) => deals.find((d) => d.title === title && d.company === company);
  const tasks = [
    { title: "Созвон по брифу", kind: "MEETING", day: 0, hour: 11, company: "farm", deal: dealByTitle("Нейминг и логотип", "farm") },
    { title: "Встреча в офисе клиента", kind: "MEETING", day: 1, hour: 15, company: "logistic", deal: dealByTitle("Корпоративный сайт", "logistic") },
    { title: "Презентация концепций логотипа", kind: "MEETING", day: 3, hour: 12, company: "coffee", deal: dealByTitle("Брендбук", "coffee") },
    { title: "Отправить КП по SEO", kind: "TASK", day: 0, hour: 18, company: "furniture", column: "main_todo", assignee: anna.id },
    { title: "Подготовить договор", kind: "TASK", day: 1, hour: 18, company: "law", column: "main_todo", assignee: max.id },
    { title: "Позвонить по счёту", kind: "TASK", day: -2, hour: 12, company: "garage", column: "main_todo", assignee: max.id },
    { title: "Макеты главной страницы", kind: "TASK", day: 4, hour: 18, company: "clinic", column: "main_progress", assignee: olga.id },
    { title: "Сверстать карточку товара", kind: "TASK", day: 6, hour: 18, company: "dent", column: "main_progress", assignee: olga.id },
    { title: "Проверить адаптив", kind: "TASK", day: 2, hour: 18, company: "stroy", column: "main_review", assignee: anna.id },
    { title: "Собрать отзывы клиентов", kind: "TASK", day: -5, hour: 18, company: null, column: "main_todo", assignee: guest.id, done: true },
  ] as const;
  for (const [i, t] of tasks.entries()) {
    const start = daysFromNow(t.day, t.hour);
    const deal = "deal" in t ? t.deal : undefined;
    await prisma.event.create({
      data: {
        kind: t.kind,
        title: t.title,
        start,
        end: new Date(start.getTime() + 60 * 60_000),
        companyId: t.company ? companies.get(t.company)!.id : null,
        dealId: deal?.id ?? null,
        columnId: "column" in t ? t.column : null,
        assigneeId: "assignee" in t ? t.assignee : null,
        done: "done" in t ? t.done : false,
        position: i,
      },
    });
  }

  // Переписки в мессенджерах: в демо-версии мессенджеры не подключены, сообщения только для просмотра
  const chats = [
    {
      channel: "TELEGRAM",
      name: "Дарья Белова",
      username: "daria_demo",
      company: "coffee",
      messages: [
        ["IN", "Добрый день! Посмотрели концепции логотипа, нравится второй вариант"],
        ["OUT", "Здравствуйте, Дарья! Отлично, доработаем его и пришлём брендбук на согласование"],
        ["IN", "Можно добавить вариант с зелёным цветом?"],
      ],
    },
    {
      channel: "VK",
      name: "Артём Ключев",
      username: null,
      company: "garage",
      messages: [
        ["IN", "Счёт получили, оплатим в четверг"],
        ["OUT", "Спасибо! После оплаты сразу начнём прототип"],
      ],
    },
    {
      channel: "TELEGRAM",
      name: "Роман Гусев",
      username: "roman_demo",
      company: null,
      messages: [["IN", "Здравствуйте, оставлял заявку на сайт для студии йоги. Когда сможете созвониться?"]],
    },
  ] as const;
  for (const [i, c] of chats.entries()) {
    const last = c.messages[c.messages.length - 1];
    const lastAt = daysFromNow(-i, 9 + i, 30);
    await prisma.conversation.create({
      data: {
        channel: c.channel,
        externalId: `demo-${i + 1}`,
        name: c.name,
        username: c.username,
        companyId: c.company ? companies.get(c.company)!.id : null,
        unread: last[0] === "IN" ? 1 : 0,
        lastText: last[1],
        lastMessageAt: lastAt,
        messages: {
          create: c.messages.map(([direction, text], j) => ({
            direction,
            text,
            author: direction === "OUT" ? ANNA : null,
            createdAt: new Date(lastAt.getTime() - (c.messages.length - 1 - j) * 20 * 60_000),
          })),
        },
      },
    });
  }

  // Ежемесячные платежи (LTV-платежи)
  const thisMonth = monthKey(new Date());
  const startMonth = monthKey(daysFromNow(-150));
  await prisma.subscription.create({
    data: { title: "SEO-продвижение", service: "SEO", amount: 40000, billingDay: 5, companyId: companies.get("stroy")!.id, startMonth },
  });
  await prisma.subscription.create({
    data: { title: "Ведение Яндекс Директа", service: "CONTEXT_ADS", amount: 25000, billingDay: 10, companyId: companies.get("fitness")!.id, startMonth: thisMonth },
  });

  // План продаж менеджеров на текущий месяц для отчёта на дашборде
  await prisma.appSetting.create({
    data: { key: "managers.plan", value: JSON.stringify({ [ANNA]: { [thisMonth]: 400000 }, [MAX]: { [thisMonth]: 350000 } }) },
  });

  await prisma.knowledgeItem.createMany({
    data: [
      {
        title: "Скрипт первого звонка",
        kind: "SCRIPT",
        author: ANNA,
        content:
          "<p>1. Представиться и уточнить, удобно ли говорить.</p><p>2. Спросить, с чем клиент пришёл: идея, логотип, сайт.</p><p>3. Договориться о встрече для брифа.</p>",
      },
      {
        title: "Бриф на разработку сайта",
        kind: "BRIEF",
        author: MAX,
        content: "<p>Цель сайта, целевая аудитория, конкуренты, примеры, которые нравятся, структура, сроки и бюджет.</p>",
      },
    ],
  });

  await prisma.activity.createMany({
    data: [
      { section: "deals", kind: "move", text: "Сделка «Яндекс Директ, ведение» перенесена в «Оплачен»", actor: MAX, createdAt: daysFromNow(-2, 16) },
      { section: "leads", kind: "create", text: "Новый лид с Тильды: Роман Гусев", actor: null, createdAt: daysFromNow(0, 9, 5) },
      { section: "clients", kind: "create", text: "Добавлен клиент «Салон красоты «Лаванда»»", actor: ANNA, createdAt: daysFromNow(-2, 11) },
    ],
  });
}

// Сбер в демо-версии: счёт выглядит подключённым, поступления за год лежат в «Финансах» и на дашборде банка.
// Ключей и сертификата нет, поэтому в банк демо не ходит: syncSber в демо ничего не запрашивает
export const DEMO_SBER_ACCOUNT = "40702810900000000001";

async function seedDemoBank(
  prisma: PrismaClient,
  paid: { id: string; seq: number; date: Date; amount: number; paidAt: Date; company: CompanyKey }[],
) {
  const name = (key: CompanyKey) => COMPANIES.find((c) => c.key === key)!.name;
  const inn = (key: CompanyKey) => `77000000${String(COMPANIES.findIndex((c) => c.key === key) + 10).padStart(2, "0")}`;
  const ru = (d: Date) => d.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow" });
  let n = 0;
  for (const p of paid) {
    await prisma.bankPayment.create({
      data: {
        transactionId: `demo-sber-${++n}`,
        date: p.paidAt,
        amount: p.amount,
        payerName: name(p.company),
        payerInn: inn(p.company),
        purpose: `Оплата по счету № ${p.seq} от ${ru(p.date)}. Без НДС`,
        documentId: p.id,
      },
    });
  }
  // Поступления без счёта из CRM: LTV-платежи по договору и возврат
  const other = [
    { daysAgo: 35, amount: 40000, company: "stroy", purpose: "Оплата за SEO-продвижение по договору, ежемесячный платёж. Без НДС" },
    { daysAgo: 5, amount: 40000, company: "stroy", purpose: "Оплата за SEO-продвижение по договору, ежемесячный платёж. Без НДС" },
    { daysAgo: 9, amount: 25000, company: "fitness", purpose: "Ведение рекламы в Яндекс Директ. Без НДС" },
  ] as const;
  for (const o of other) {
    await prisma.bankPayment.create({
      data: {
        transactionId: `demo-sber-${++n}`,
        date: new Date(Date.now() - o.daysAgo * DAY),
        amount: o.amount,
        payerName: name(o.company),
        payerInn: inn(o.company),
        purpose: o.purpose,
      },
    });
  }
  const now = Date.now();
  await prisma.appSetting.createMany({
    data: [
      {
        key: "sber.client",
        value: JSON.stringify({ clientId: "demo", clientSecret: "", redirectUri: "https://demo.example.ru/integrations/sber/callback", pfx: "", passphrase: "" }),
      },
      { key: "sber.tokens", value: JSON.stringify({ accessToken: "", refreshToken: "", expiresAt: now }) },
      { key: "sber.account", value: DEMO_SBER_ACCOUNT },
      { key: "sber.accounts", value: JSON.stringify([{ number: DEMO_SBER_ACCOUNT, name: "Расчётный счёт" }]) },
      { key: "sber.historyLoaded", value: new Date(now).toISOString() },
    ],
  });
}
