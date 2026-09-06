class IpoProvider {
  async list() {
    throw new Error('IPO provider list is not implemented');
  }

  async getById() {
    throw new Error('IPO provider details are not implemented');
  }
}

module.exports = IpoProvider;
