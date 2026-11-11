import { test } from "node:test";
import assert from "node:assert/strict";
import { mentionQuery, mentionedLogins, splitMentions, suggestPeople } from "../lib/mentions";

const logins = ["selin", "anna.k", "petrov-a"];

test("mentionedLogins: только известные логины, без почты и повторов", () => {
  assert.deepEqual(mentionedLogins("@selin глянь, @Selin ещё раз", logins), ["selin"]);
  assert.deepEqual(mentionedLogins("пишите на ivan@selin.ru", logins), []);
  assert.deepEqual(mentionedLogins("@anna.k. и @petrov-a, @nobody", logins), ["anna.k", "petrov-a"]);
});

test("splitMentions: режет текст вокруг упоминаний", () => {
  assert.deepEqual(splitMentions("селин @selin.", logins), [{ text: "селин " }, { text: "@selin", login: "selin" }, { text: "." }]);
  assert.deepEqual(splitMentions("@nobody привет", logins), [{ text: "@nobody привет" }]);
  assert.deepEqual(splitMentions("(@anna.k)", logins), [{ text: "(" }, { text: "@anna.k", login: "anna.k" }, { text: ")" }]);
});

test("mentionQuery: подсказка только сразу после @ в начале слова", () => {
  assert.equal(mentionQuery("привет @"), "");
  assert.equal(mentionQuery("привет @se"), "se");
  assert.equal(mentionQuery("@Илья"), "Илья");
  assert.equal(mentionQuery("ivan@pro"), null);
  assert.equal(mentionQuery("@selin готово"), null);
});

test("suggestPeople: логин и имя, свой логин тоже в списке", () => {
  const people = [
    { name: "Илья Селин", login: "selin" },
    { name: "Анна Котова", login: "anna.k" },
    { name: "Алексей Петров", login: "petrov-a" },
  ];
  assert.equal(suggestPeople(people, "").length, 3);
  assert.deepEqual(suggestPeople(people, "se").map((p) => p.login), ["selin"]);
  assert.deepEqual(suggestPeople(people, "пет").map((p) => p.login), ["petrov-a"]);
  assert.deepEqual(suggestPeople(people, "а").map((p) => p.login), ["anna.k", "petrov-a"]);
});
