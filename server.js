const express = require('express');
const http = require('http');
const {Pool} = require('pg');
const {port,host,database, password} =require('./config');

const app = express();
const bodyParser = require('body-parser');

// const port = process.env.PORT;

// connection to database on render.com
const db = new Pool({
  type:'postgres',
  user: 'tushar',
  host: host,
  database: database,
  password: password,
  port: 5432,
  ssl:true
});

//create user table if it does not exists
db.query(`CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50),
  mobile BIGINT NOT NULL UNIQUE,
  address VARCHAR(200),
  email VARCHAR(30),
  password VARCHAR(15) NOT NULL,
  user_type VARCHAR(20) CHECK (user_type IN ('admin', 'sub-admin', 'staff', 'manager', 'customer', 'owner'))
);`,(err,result)=>{
  if(err)console.error('Query Error',err);
});

//create restaurant table if it does not exists
db.query(`CREATE TABLE IF NOT EXISTS restaurant (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  address VARCHAR(200) NOT NULL,
  city VARCHAR(30) NOT NULL,
  state VARCHAR(20) NOT NULL,
  phone1 BIGINT NOT NULL,
  phone2 BIGINT,
  type VARCHAR(20) CHECK (type IN ('veg', 'non-veg', 'veg & non-veg')) NOT NULL,
  ethnicity VARCHAR(30),
  table_capacity INT,
  service_type VARCHAR(50),
  location VARCHAR(100)
);`,(err,result)=>{
  if(err)console.error('Query Error',err);
});

//create menu table if it does not exists
db.query(`CREATE TABLE IF NOT EXISTS menu (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) CHECK (type IN ('veg', 'non-veg', 'mixed')),
  food_item VARCHAR(200) NOT NULL,
  food_desc VARCHAR(500),
  price INT,
  restaurant_id INT NOT NULL,
  CONSTRAINT fk_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurant(id)
);`,(err,result)=>{
  if(err)console.error('Query Error',err);
});

//create food Item table if it does not exists
db.query(`CREATE TABLE IF NOT EXISTS food_item (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) CHECK (type IN ('veg', 'non-veg')),
  name VARCHAR(100) NOT NULL,
  genre VARCHAR(50),
  menu_id INT NOT NULL,
  CONSTRAINT fk_menu_id FOREIGN KEY (menu_id) REFERENCES menu(id)
);`,(err,result)=>{
  if(err)console.error('Query Error',err);
});

//create bookings table if it does not exists
db.query(`CREATE TABLE IF NOT EXISTS bookings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  table_no VARCHAR(50),
  details TEXT,
  guests INT,
  booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  visit_date DATE,
  visit_time TIME,
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES "users" (id),
  CONSTRAINT fk_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
);`,(err,result)=>{
  if(err)console.error('Query Error',err);
});

//create reviews table if it does not exists
db.query(`CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  review TEXT,
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES "users" (id),
  CONSTRAINT fk_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
);`,(err,result)=>{
  if(err)console.error('Query Error',err);
});


app.use('/static', express.static('public'));

app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

// root site
app.get('/', function(req,res){
    res.sendFile(__dirname + '/public/home.html');
});

app.get('/')


app.post("/api/login", (req, res) => {
  const mobile = parseInt(req.body.mobile);
  db.connect((err) => {
      if (err) console.log("Connection Error: ", err);
      else {
          db.query(
              `SELECT id, first_name, last_name, address, mobile, type FROM users WHERE mobile=${mobile};`,
              (err, result, fields) => {
                  if (err) console.log('Query Error:', err);
                  else res.send(result.rows);
              }
          );
      }
  });
});

app.post("/api/register", (req,res)=>{
  const data = req.body;
  db.connect((err)=>{
    if(err) console.log('Connection Error: ',err);
    else {
      db.query(
        `INSERT INTO users (first_name, last_name, address, mobile, type, password) VALUES ('${data.first_name}', '${data.last_name}', '${data.address}', ${data.mobile}, '${data.type}','${data.password}');`,(err, result)=>{
          if(err) console.log('Query Error: ',err);
          else res.send(result.rows); 
        }
      );
    }
  });
});

app.get("/api/user/:id", (req,res)=>{
  const id = parseInt(req.params.id);
  db.connect((err)=> {
    if(err) console.log('Connection Error: ',err);
    db.query(
      `SELECT * FROM users WHERE id=${id};`,(err,result,fields)=>{
        if(err) console.log(err);
        res.send(result.rows);
      }
    )
  });
});

app.get("/api/restaurants", (req, res) => {
  const filter = req.body;
  // Prepare SQL query with parameterized values
  const sqlQuery = `SELECT * FROM restaurants WHERE 1=1 
                    ${filter.name ? `AND name LIKE '%${filter.name}%'` : ''}
                    ${filter.city ? `AND city='${filter.city}'` : ''}
                    ${filter.type ? `AND type='${filter.type}'` : ''}
                    ${filter.ethnicity ? `AND ethnicity='${filter.ethnicity}'` : ''}
                    ${filter.table_capacity ? `AND table_capacity >= ${filter.table_capacity}` : ''}
                    ${filter.service_type ? `AND service_type='${filter.service_type}'` : ''}`;
    db.connect((err) => {
      if (err) {console.log("Connection error", err);return res.status(500).json({ error: "Database connection error" });}
      db.query(sqlQuery,(err, result, fields) => {
          if (err) {
            console.log(err);
            return res.status(500).json({ error: "Database query error" });
          }
          res.json({
            length:result.rowCount,
            data:result.rows,
          });
        }
      );
    });
  });

app.get('/api/menu/:id',(req,res)=>{
  const id = req.params.id;
  db.connect((err)=>{
    if (err) console.log("Connection Error: ", err);
    db.query(
      `SELECT * FROM menu WHERE restaurant_id=${id};`,(err,result,fields)=>{
        if(err) res.send(err);
        res.json({
          length:result.rowCount,
          data:result.rows
        });
      }
    );
  });
});

app.post('/api/booking',(req,res)=>{
  const data = req.body;
  db.connect((err)=>{
    if (err) console.log("Connection Error: ", err);
    db.query(
      `INSERT INTO bookings (user_id, restaurant_id, table_no, details, guests, booking_date, visit_date, visit_time) 
      VALUES (${data.user_id}, 
        ${data.restaurant_id}, 
        ${data.table_no}, 
        '${data.details}', 
        ${data.guests}, 
        '${data.booking_date}',
        '${data.visit_date}', 
        '${data.visit_time}');`,(err,result,fields)=>{
        if(err) res.send(err);
        res.json({
          length:result.rowCount,
          data:result.rows
        });
      }
    );
  });
});

app.post('/api/add-review', (req,res)=>{
  const data = req.body;
  db.connect((err)=>{
    if(err) console.log('Connection Error: ',err);
    else{
      db.query(
        `INSERT INTO reviews (user_id, restaurant_id, review, )`
      )
    }
  })
});


app.listen(port,function(){
    console.log(`Listening on port ${port}`);
});