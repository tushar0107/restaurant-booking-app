const {Pool} = require('pg');
const express = require('express');
const http = require('http');
const bcrypt = require('bcrypt');

const app = express();

// function convertToHash(plainPassword){
//     bcrypt.hash(plainPassword,8,function(err,hash){
      
//         return hash.toString();
      
//     });
//   }
  const hash = bcrypt.hashSync('Jane@123', 5);
  console.log(hash);


const connection = new Pool({
    type:'postgres',
    user: 'tushar',
    host: 'dpg-cng2rlgl6cac739lcfk0-a.singapore-postgres.render.com',
    database: 'restrodb',
    password: 'oE6xg7RXMaZwUsdkfEaCExlYHWMzdTpT',
    port: 5432,
    ssl:true
});

// connection to database on render.com
// const db = new sqlite.Database('restrodb.db',(err)=>{
//   if(err){
//     console.log("Error Initializing database");
//   }
//   console.log('Database Connected successfully');
// });


//create user table if it does not exists
// db.each(`CREATE TABLE IF NOT EXISTS users (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   first_name VARCHAR(50) NOT NULL,
//   last_name VARCHAR(50),
//   mobile BIGINT NOT NULL UNIQUE,
//   address VARCHAR(200),
//   email VARCHAR(30),
//   password VARCHAR(15) NOT NULL,
//   user_type VARCHAR(20) CHECK (user_type IN ('admin', 'sub-admin', 'staff', 'manager', 'customer', 'owner'))
// );`,(err,result)=>{
//   if(err)console.error('Create users Table query Error: ',err);
// });

// //create restaurant table if it does not exists
// db.each(`CREATE TABLE IF NOT EXISTS restaurants (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   name VARCHAR(50) NOT NULL,
//   address VARCHAR(200) NOT NULL,
//   city VARCHAR(30) NOT NULL,
//   state VARCHAR(20) NOT NULL,
//   phone1 BIGINT NOT NULL,
//   phone2 BIGINT,
//   type VARCHAR(20) CHECK (type IN ('veg', 'non-veg', 'veg & non-veg')) NOT NULL,
//   ethnicity VARCHAR(30),
//   table_capacity INT,
//   service_type VARCHAR(50),
//   location VARCHAR(100),
//   owner INT NOT NULL,
//   CONSTRAINT fk_restaurant FOREIGN KEY (owner) REFERENCES users(id)
// );`,(err,result)=>{
//   if(err)console.error('Create restaurants Table query Error: ',err);
// });

// //create menu table if it does not exists
// db.each(`CREATE TABLE IF NOT EXISTS menu (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   type VARCHAR(20) CHECK (type IN ('veg', 'non-veg', 'mixed')),
//   food_item VARCHAR(200) NOT NULL,
//   food_desc VARCHAR(500),
//   price INT,
//   food_image_url VARCHAR(150),
//   restaurant_id INT NOT NULL,
//   CONSTRAINT fk_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurant(id)
// );`,(err,result)=>{
//   if(err)console.error('Create menu Table query Error: ',err);
// });

// //create food Item table if it does not exists
// db.each(`CREATE TABLE IF NOT EXISTS food_item (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   type VARCHAR(20) CHECK (type IN ('veg', 'non-veg')),
//   name VARCHAR(100) NOT NULL,
//   genre VARCHAR(50),
//   menu_id INT NOT NULL,
//   CONSTRAINT fk_menu_id FOREIGN KEY (menu_id) REFERENCES menu(id)
// );`,(err,result)=>{
//   if(err)console.error('Create food_item Table query Error: ',err);
// });

// //create bookings table if it does not exists
// db.each(`CREATE TABLE IF NOT EXISTS bookings (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   user_id INT NOT NULL,
//   restaurant_id INT NOT NULL,
//   table_no VARCHAR(50),
//   details TEXT,
//   guests INT,
//   booking_date TIMESTAMP WITHOUT TIME ZONE,
//   visit_date DATE,
//   visit_time TIME,
//   CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id),
//   CONSTRAINT fk_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
// );`,(err,result)=>{
//   if(err)console.error('Create bookings Table query Error: ',err);
// });

// //create reviews table if it does not exists
// db.each(`CREATE TABLE IF NOT EXISTS reviews (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   user_id INT NOT NULL,
//   restaurant_id INT NOT NULL,
//   review TEXT,
//   CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id),
//   CONSTRAINT fk_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
// );`,(err,result)=>{
//   if(err)console.error('Create reviews Table query Error: ',err);
// });

app.get('/',(req,res)=>{
    connection.query('SELECT * FROM users;', (err, result)=>{
        if(err)console.log('Query Error: ', err);
        else{
            res.send(result.rows);
        }
    });
});

app.listen(8000, function(){
    console.log('server listening on 8000');
})