const messageQueue = [];

function enqueue(message) {
  messageQueue.push(message);
}

function dequeue() {
  return messageQueue.shift();
}

function hasMessages() {
  return messageQueue.length > 0;
}

module.exports = {
  enqueue,
  dequeue,
  hasMessages
};