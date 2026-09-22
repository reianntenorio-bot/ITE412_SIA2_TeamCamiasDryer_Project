const {
  submitDryingRequest
} = require("./producer.cjs");

const {
  processDryingRequest
} = require("./consumer.cjs");

console.log("========================================");
console.log("CAMIAS DRYER - MESSAGING MIDDLEWARE");
console.log("Producer-Consumer Demonstration");
console.log("========================================\n");

console.log("PRODUCER: Submitting drying requests...\n");

submitDryingRequest(
  "BATCH-001",
  "Dried Camias",
  8,
  45,
  60
);

submitDryingRequest(
  "BATCH-002",
  "Camias Powder",
  10,
  50,
  55
);

submitDryingRequest(
  "BATCH-003",
  "Dried Camias",
  12,
  55,
  70
);

console.log("\nCONSUMER: Processing messages asynchronously...\n");

setTimeout(() => {
  processDryingRequest();
}, 1000);

setTimeout(() => {
  processDryingRequest();
}, 2000);

setTimeout(() => {
  processDryingRequest();
}, 3000);