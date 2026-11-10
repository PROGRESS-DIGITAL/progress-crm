import { test } from "node:test";
import assert from "node:assert/strict";
import { demoReadOnly } from "../lib/demo";

test("демо-версия: настройки интеграций, сотрудников и профиля только для просмотра", () => {
  assert.equal(demoReadOnly("app/integrations/telegram/actions.ts"), true);
  assert.equal(demoReadOnly("/abs/path/progress-crm/app/employees/actions.ts"), true);
  assert.equal(demoReadOnly("app\\profile\\actions.ts"), true);
  assert.equal(demoReadOnly("/integrations/tilda"), true);
});

test("демо-версия: рабочие разделы и выход сохраняются как обычно", () => {
  assert.equal(demoReadOnly("app/deals/actions.ts"), false);
  assert.equal(demoReadOnly("app/login/actions.ts"), false);
  assert.equal(demoReadOnly("/deals"), false);
  assert.equal(demoReadOnly(""), false);
});
