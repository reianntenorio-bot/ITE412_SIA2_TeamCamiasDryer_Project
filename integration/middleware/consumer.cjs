const { dequeue, hasMessages } = require("./queue.cjs");

function processDryingRequest() {
  if (!hasMessages()) {
    console.log("No drying requests in the queue.");
    return;
  }

  const request = dequeue();

  let decision;

  // Demo rule:
  // A drying request is accepted when the batch weight
  // is 10 kg or below.
  if (request.weight <= 10) {
    decision = "Accepted";
  } else {
    decision = "Rejected";
  }

  console.log(
    `Drying request for ${request.batchId} → ${decision}`
  );

  console.log(
    `Processing ${request.product}: ${request.weight} kg, ${request.temperature}°C, ${request.humidity}% humidity`
  );
}

module.exports = {
  processDryingRequest
};