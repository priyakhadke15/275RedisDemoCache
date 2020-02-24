var express = require('express');
var router = express.Router();
const mysql = require('mysql');
const redis = require('redis');

const conf = {
  sql_host: 'localhost',
  sql_port: "3306",
  sql_user: 'admin',
  sql_password: 'mypass',
  sql_database: 'GrubHub',
  sql_connectionLimit: 50,
};

const pool = mysql.createPool({
  connectionLimit: conf.sql_connectionLimit,
  host: conf.sql_host,
  port: conf.sql_port,
  user: conf.sql_user,
  password: conf.sql_password,
  database: conf.sql_database,
  multipleStatements: true
});

const getConnection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      // console.log("connected")
      return err ? reject(err) : resolve(connection);
    });
  });
};

/* GET users listing from DB*/
router.get('/db', async function (req, res, next) {
  const { ts } = req.query;

  const conn = await getConnection();
  const { results } = await getRecords(conn)(ts);
  res.send(results);
});


// create and connect redis client to local instance.
const client = redis.createClient();

// Print redis errors to the console
client.on('error', (err) => {
  console.log("Error " + err);
});


/* GET users listing from Redis Cache*/
router.get('/cache', function (req, res, next) {
  const { ts } = req.query;
  return client.get(`select * from demo where ts=${ts}`, async (err, result) => {
    if (result) {
      res.status(200).send(result);
    }
    else {
      const conn = await getConnection();
      const { results } = await getRecords(conn)(ts);
      client.setex(`select * from demo where ts=${ts}`, 3600, JSON.stringify({ source: 'Redis Cache', ...results, }));
      res.status(200).send(results);
    }
  })
});

const getRecords = connection => (ts) => {

  let query = `select * from demo where ts=${ts}`;
  // console.log(query);
  return new Promise((resolve, reject) => {
    connection.query(query, (error, results, fields) => {
      // release connection 
      connection.release();
      if (error) {
        reject(error);
      } else {
        resolve({ results, fields });
      }
    });
  });
};

module.exports = router;