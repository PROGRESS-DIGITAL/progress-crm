import { DEMO_READ_ONLY_MESSAGE } from "@/lib/demo";

// Полоса над разделами в демо-версии: гость сразу видит, что данные вымышленные
export function DemoBanner() {
  return (
    <div className="rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-800">
      <span className="font-medium">Демо-версия.</span> Клиенты и сделки вымышленные, можно всё пробовать: каждую ночь данные
      возвращаются к исходным.
    </div>
  );
}

// Над интеграциями, сотрудниками и профилем: здесь можно посмотреть, но не сохранить
export function DemoReadOnlyNotice() {
  return <div className="mb-3 rounded-2xl bg-amber-50 px-4 py-2 text-sm text-amber-800">{DEMO_READ_ONLY_MESSAGE}.</div>;
}
