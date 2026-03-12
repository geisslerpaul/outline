"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE teams SET "guestSignin" = true WHERE "guestSignin" = false
    `);
  },

  async down() {
    // Cannot safely revert - we don't track which teams had guestSignin false
  },
};
