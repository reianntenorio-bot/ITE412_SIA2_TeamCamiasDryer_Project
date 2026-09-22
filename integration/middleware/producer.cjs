const { enqueue } = require("./queue.cjs");

function submitDryingRequest(batchId, product, weight, temperature, humidity) {
  const request = {
    batchId,
    product,
    weight,
    temperature,
    humidity
  };

  enqueue(request);

  console.log(
    `Drying request submitted: ${JSON.stringify(request)}`
  );
}

module.exports = {
  submitDryingRequest
};