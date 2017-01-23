var sequelize = require('sequelize');
var Report = require('../report');

module.exports = function (config) {
  var sequelizeDB = new sequelize(config.sql.connectionString, {
    dialect: 'postgres'
  });

  // Authenticate and connect to DB
  sequelizeDB.authenticate()
    .then(function() { console.log('Connection has been established successfully.'); })
    .catch(function (err) { console.log('Unable to connect to the database.'); });

  // Define schema
  var cspViolation = sequelizeDB.define('cspViolation', Report.prototype.getSQLDefinition(sequelize));

  // Create table
  sequelizeDB.sync({})
    .then(function() { console.log('Table created.'); })
    .catch(function (err) { console.log('ERROR: An error occurred while creating the table.', JSON.stringify(err, null, 2)); })
  });

  function storeViolation(report) {
    // Directly create record in DB
    cspViolation.create(report.getRaw())
      .then(function () { console.log('Violation stored.'); });
      .catch(function (err) { console.log('ERROR storing violation', JSON.stringify(err)); });
  }
  return {
    save: storeViolation
  };
};
