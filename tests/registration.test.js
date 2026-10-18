const test = require("node:test");
const assert = require("node:assert/strict");
const { calculate, amountString, sha512, verifyResponseHash } = require("../api/_shared");

test("calculates event, food and accommodation totals from trusted prices", () => {
  const result = calculate(["E01", "E02", "E03"], true, "shared");
  assert.equal(result.eventTotal, 1800);
  assert.equal(result.foodTotal, 900);
  assert.equal(result.accommodationTotal, 1500);
  assert.equal(result.total, 4200);
  assert.equal(amountString(result.total), "4200.00");
});

test("calculates registration with no add-ons", () => {
  const result = calculate(["E06"], false, "none");
  assert.equal(result.eventTotal, 300);
  assert.equal(result.foodTotal, 0);
  assert.equal(result.accommodationTotal, 0);
  assert.equal(result.total, 300);
});

test("supports private accommodation and optional food", () => {
  const result = calculate(["E01"], false, "private");
  assert.equal(result.total, 3250);
});

test("rejects an empty event selection", () => {
  assert.throws(() => calculate([], false, "none"), /Choose between 1 and 20 events/);
});

test("rejects duplicate event IDs", () => {
  assert.throws(() => calculate(["E01", "E01"], false, "none"), /Invalid or duplicate event selection/);
});

test("rejects unknown event IDs", () => {
  assert.throws(() => calculate(["E99"], false, "none"), /Invalid or duplicate event selection/);
});

test("rejects more than 20 event IDs", () => {
  assert.throws(() => calculate(Array(21).fill("E01"), false, "none"), /Choose between 1 and 20 events/);
});

test("rejects same-slot events on Day 1", () => {
  assert.throws(() => calculate(["E01", "E05"], false, "none"), /Event time conflict/);
  assert.throws(() => calculate(["E02", "E07"], false, "none"), /Event time conflict/);
});

test("rejects same-slot events on Day 2", () => {
  for (const pair of [["E08", "E09"], ["E10", "E11"], ["E12", "E13"], ["E14", "E15"]]) {
    assert.throws(() => calculate(pair, false, "none"), /Event time conflict/);
  }
});

test("rejects same-slot events on Day 3", () => {
  assert.throws(() => calculate(["E16", "E18"], false, "none"), /Event time conflict/);
});

test("allows events in different slots and on different days", () => {
  const result = calculate(["E01", "E02", "E08", "E17", "E20"], false, "none");
  assert.equal(result.events.length, 5);
  assert.equal(result.total, 2400);
});

test("rejects non-boolean food selection and unknown accommodation", () => {
  assert.throws(() => calculate(["E01"], "yes", "none"), /Invalid food selection/);
  assert.throws(() => calculate(["E01"], false, "suite"), /Invalid accommodation selection/);
});

test("verifies the PayU reverse hash and rejects tampering", () => {
  const salt = "test-salt";
  const data = {
    status: "success",
    udf1: "RESMAGNA2027",
    udf2: "", udf3: "", udf4: "", udf5: "",
    email: "participant@example.com",
    firstname: "Participant",
    productinfo: "RESMAGNA 2027 Registration",
    amount: "4200.00",
    txnid: "RM27TEST123",
    key: "test-key"
  };
  const source = [salt, data.status, "", "", "", "", "", data.udf5, data.udf4, data.udf3, data.udf2, data.udf1, data.email, data.firstname, data.productinfo, data.amount, data.txnid, data.key].join("|");
  data.hash = sha512(source);
  assert.equal(verifyResponseHash(data, salt), true);
  assert.equal(verifyResponseHash({ ...data, amount: "1.00" }, salt), false);
  assert.equal(verifyResponseHash({ ...data, status: "failure" }, salt), false);
});

test("normalizes amount strings to two decimal places", () => {
  assert.equal(amountString(12), "12.00");
  assert.equal(amountString("12.5"), "12.50");
});
