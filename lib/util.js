module.exports.delay = function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports.defer = function defer() {
  let d = {};
  d.promise = new Promise((resolve, reject) => {
    d.resolve = resolve;
    d.reject  = reject;
  });
  return d;
};
