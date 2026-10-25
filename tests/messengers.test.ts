import { test } from "node:test";
import assert from "node:assert/strict";
import { incomingFromMax } from "../lib/chat/max";
import { incomingFromVk } from "../lib/chat/vk";

test("Max: личное сообщение боту", () => {
  const m = incomingFromMax({
    update_type: "message_created",
    timestamp: 1_761_400_000_000,
    message: {
      sender: { user_id: 555, first_name: "Олег", last_name: "Ким", username: "oleg" },
      recipient: { chat_id: 9, chat_type: "dialog" },
      timestamp: 1_761_400_000_000,
      body: { mid: "mid.1", text: "Добрый день" },
    },
  });
  assert.deepEqual(m, {
    externalId: "555",
    name: "Олег Ким",
    username: "oleg",
    text: "Добрый день",
    messageId: "mid.1",
    date: new Date(1_761_400_000_000),
  });
});

test("Max: групповые чаты и другие события пропускаем", () => {
  const message = { sender: { user_id: 1, name: "A" }, recipient: { chat_type: "chat" }, timestamp: 0, body: { mid: "m", text: "x" } };
  assert.equal(incomingFromMax({ update_type: "message_created", timestamp: 0, message }), null);
  assert.equal(incomingFromMax({ update_type: "bot_started", timestamp: 0 }), null);
});

test("VK: сообщение сообществу с именем из users.get", () => {
  const users = new Map([[101, { id: 101, first_name: "Мария", last_name: "Лис", screen_name: "maria" }]]);
  const m = incomingFromVk(
    { type: "message_new", object: { message: { id: 7, date: 1_761_400_000, peer_id: 101, from_id: 101, text: "Сколько стоит SEO?" } } },
    users,
  );
  assert.deepEqual(m, {
    externalId: "101",
    name: "Мария Лис",
    username: "maria",
    text: "Сколько стоит SEO?",
    messageId: "7",
    date: new Date(1_761_400_000_000),
  });
});

test("VK: беседы пропускаем", () => {
  const u = { type: "message_new", object: { message: { id: 1, date: 0, peer_id: 2_000_000_001, from_id: 5, text: "hi" } } };
  assert.equal(incomingFromVk(u, new Map()), null);
});
