import { test } from "node:test";
import assert from "node:assert/strict";
import { partyFromSuggestion } from "../lib/dadata";

test("разбирает юрлицо из ответа DaData", () => {
  const party = partyFromSuggestion({
    value: "ПАО СБЕРБАНК",
    data: {
      inn: "7707083893",
      kpp: "773601001",
      ogrn: "1027700132195",
      type: "LEGAL",
      name: { short_with_opf: "ПАО СБЕРБАНК", full_with_opf: "ПУБЛИЧНОЕ АКЦИОНЕРНОЕ ОБЩЕСТВО «СБЕРБАНК РОССИИ»" },
      management: { name: "Греф Герман Оскарович", post: "ПРЕЗИДЕНТ, ПРЕДСЕДАТЕЛЬ ПРАВЛЕНИЯ" },
      address: { value: "г Москва, ул Вавилова, д 19" },
      state: { status: "ACTIVE" },
      phones: null,
      emails: null,
    },
  });
  assert.deepEqual(party, {
    name: "ПАО СБЕРБАНК",
    inn: "7707083893",
    kpp: "773601001",
    ogrn: "1027700132195",
    address: "г Москва, ул Вавилова, д 19",
    director: "Греф Герман Оскарович (президент, председатель правления)",
    phone: null,
    email: null,
    inactive: false,
    individual: false,
  });
});

test("ИП без КПП и руководителя, ликвидированная компания помечается", () => {
  const party = partyFromSuggestion({
    value: "ИП Иванов Иван Иванович",
    data: { inn: "500100732259", ogrn: "304500116000157", type: "INDIVIDUAL", state: { status: "LIQUIDATED" } },
  });
  assert.equal(party?.name, "ИП Иванов Иван Иванович");
  assert.equal(party?.kpp, null);
  assert.equal(party?.director, null);
  assert.equal(party?.inactive, true);
  assert.equal(party?.individual, true);
});

test("у ИП руководитель — сам предприниматель, адрес берётся из полной записи", () => {
  const party = partyFromSuggestion({
    value: "ИП Петров Пётр Петрович",
    data: {
      inn: "772800123456",
      ogrn: "318774600123456",
      type: "INDIVIDUAL",
      fio: { surname: "Петров", name: "Пётр", patronymic: "Петрович" },
      address: { value: null, unrestricted_value: "117036, г Москва" },
    },
  });
  assert.equal(party?.director, "Петров Пётр Петрович (индивидуальный предприниматель)");
  assert.equal(party?.address, "117036, г Москва");
});

test("пустой ответ — ничего не найдено", () => {
  assert.equal(partyFromSuggestion({}), null);
});
