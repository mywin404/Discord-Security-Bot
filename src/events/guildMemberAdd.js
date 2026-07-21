const antiraid = require('../modules/antiraid');

module.exports = {
  async execute(member) {
    await antiraid.trackMemberJoin(member);
  }
};
