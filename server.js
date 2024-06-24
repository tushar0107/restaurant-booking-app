const express = require('express');
const http = require('http');
const ws = require('websocket').server;
const sqlite = require('sqlite3').verbose();

const multer = require('multer');//for proccessing image files
const {Pool} = require('pg');
var cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
dotenv.config();

var port = process.env.PORT;

const app = express();
const bodyParser = require('body-parser');
const { type } = require('os');

app.use(cors());

app.use('/static', express.static('public'));
app.use('/uploads', express.static('uploads'));

app.use(express.json());
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

//file storage
const storage = multer.diskStorage({
  destination: function(req,file,cb){
    cb(null,'uploads/');
  },
  filename:function(req,file,cb){
    var food = req.body;
    //rename the file to avoid conflict
    cb(null,food.id+'-'+food.food_item.replaceAll(' ','-')+'.'+file.originalname.split('.')[1]);
  }
});

const upload = multer({storage: storage});



// var whiteList = ['http://127.0.0.1:3000'];

// var corsOptions = {
//   origin: 'http://localhost:3000',
//   optionsSuccessStatus: 200
// }
app.options('*', cors())

// connection to database on render.com
const db = new sqlite.Database('restrodb.db',(err)=>{
  if(err){
    console.log("Error Initializing database");
  }
  console.log('Database Connected successfully');
});


//create user table if it does not exists
db.each(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50),
  mobile BIGINT NOT NULL UNIQUE,
  address VARCHAR(200),
  email VARCHAR(30),
  password VARCHAR(15) NOT NULL,
  user_type VARCHAR(20) CHECK (user_type IN ('admin', 'sub-admin', 'staff', 'manager', 'customer', 'owner'))
);`,(err,result)=>{
  if(err)console.error('Create users Table query Error: ',err);
});

//create restaurant table if it does not exists
db.each(`CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  location VARCHAR(100),
  owner INT NOT NULL,
  CONSTRAINT fk_restaurant FOREIGN KEY (owner) REFERENCES users(id)
);`,(err,result)=>{
  if(err)console.error('Create restaurants Table query Error: ',err);
});

//create menu table if it does not exists
db.each(`CREATE TABLE IF NOT EXISTS menu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type VARCHAR(20) CHECK (type IN ('veg', 'non-veg', 'mixed')),
  food_item VARCHAR(200) NOT NULL,
  food_desc VARCHAR(500),
  price INT,
  food_image_url VARCHAR(150),
  restaurant_id INT NOT NULL,
  CONSTRAINT fk_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurant(id)
);`,(err,result)=>{
  if(err)console.error('Create menu Table query Error: ',err);
});

//create food Item table if it does not exists
db.each(`CREATE TABLE IF NOT EXISTS food_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type VARCHAR(20) CHECK (type IN ('veg', 'non-veg')),
  name VARCHAR(100) NOT NULL,
  genre VARCHAR(50),
  menu_id INT NOT NULL,
  CONSTRAINT fk_menu_id FOREIGN KEY (menu_id) REFERENCES menu(id)
);`,(err,result)=>{
  if(err)console.error('Create food_item Table query Error: ',err);
});

//create bookings table if it does not exists
db.each(`CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  table_no VARCHAR(50),
  details TEXT,
  guests INT,
  booking_date TIMESTAMP WITHOUT TIME ZONE,
  visit_date DATE,
  visit_time TIME,
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);`,(err,result)=>{
  if(err)console.error('Create bookings Table query Error: ',err);
});

//create reviews table if it does not exists
db.each(`CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INT NOT NULL,
  restaurant_id INT NOT NULL,
  review TEXT,
  CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_restaurant_id FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
);`,(err,result)=>{
  if(err)console.error('Create reviews Table query Error: ',err);
});


// root site
app.get('/', function(req,res){
    res.sendFile(__dirname + '/public/home.html');
});
// clock site
app.get('/clock', function(req,res){
  res.sendFile(__dirname + '/public/clock.html');
});

//user login api with form data (mobile and password)
app.post("/api/login", (req, res) => {
  const mobile = parseInt(req.body.mobile);
  const plainPassword = req.body.password;

  db.serialize((err) => {
      if (err) console.log("Connection Error: ", err);
      else {
          db.get(`SELECT * FROM users WHERE mobile=${mobile};`,(err, result) => {
            if (err) {
              console.log('Query Error: User Login ', err)
            }else if(result) {
              if(result.length==1){
                res.send({'message':'Mobile number does not exists','data':result});
              }else{
                var dbPassword = result.password;
                const isValidPassword = bcrypt.compareSync(plainPassword,dbPassword);
                if(isValidPassword==true){
                  if(result.user_type=='owner'){
                    db.all(`SELECT * FROM restaurants WHERE owner=${result.id};`,(err,result_rest)=>{
                      if (err) {
                        console.log(err);
                        return res.status(500).json({ error: "Database query error" });
                      }else{res.json({'status':true,'user':result,'restaurant':result_rest});}
                    });
                  }else{
                    res.status(200).json({'status':true,'user':result});
                  }
                }else{
                  res.send({'status':false,'message':'Incorrect Password'});
                }
              }
            }else{
              res.send({'status':false,'message':'Mobile Number not found. Please Check again'});
            }
          }
        );
      }
  });
});

//register user with the values (first_name, last_name, address, mobile, email, user_type('customer'), password)
app.post("/api/register-user", (req,res)=>{
  const data = req.body;
  //converts user's plain password to hashed password
  const hashedPassword = bcrypt.hashSync(data.password,8);

  db.serialize((err)=>{
    if(err) console.log('Connection Error: ',err);
    else {
      //check if there already exists the mobile number in users table
      db.get(`SELECT mobile FROM users WHERE mobile=${data.mobile};`,function(err,result){
        if(err){
          console.log('Query Error: - Check Mobiles in db while registering user: ',err);
        }else{
          if(result){
            res.send({'message':'Mobile number already exists'});
          }else{
            db.run(
              `INSERT INTO users (first_name, last_name, address, mobile, email, user_type, password) VALUES ('${data.first_name}', '${data.last_name}', '${data.address}', ${data.mobile}, '${data.email}', '${data.user_type ? data.user_type : 'customer'}','${hashedPassword}');`,(err, result)=>{
                if(err) console.log('Query Error: registering user ',err);
                else res.status(200).json({'message':'User registered successfully'});
              }
            );
          }
        }
      });
    }
  });
});

// update user info required mobile and password
app.post('/api/update-user',function(req,res){
  const data = req.body;
  //converts user's plain password to hashed password
  if(!data.mobile){
    res.status(200).json({'messsage':'Mobile number required'});
  }else if(!data.password){
    res.status(200).json({'messsage':'Password required'});
  }else{
  const hashedPassword = bcrypt.hashSync(data.password,8);

  const sqlQuery = `UPDATE users SET ${data.first_name ? `first_name='${data.first_name}',`:''}
                                     ${data.last_name ? `last_name='${data.last_name}',`:''}
                                     ${data.address ? `address='${data.address}',`:''}
                                     ${data.email ? `email='${data.email}',`:''}
                                     ${data.user_type ? `user_type='${data.user_type}',`:''}
                                     ${data.password ? `password='${hashedPassword}'`:''}
                    WHERE id=${data.id};`;
  db.serialize((err)=>{
    if(err) console.log('Connection Error: ',err);
    else{
      db.get(`SELECT password FROM users WHERE mobile=${data.mobile};`,function(err,result){
        if(err) console.log('Query error - validating user: ',err);
          if(result.password){
            var isValidPassword = bcrypt.compareSync(data.password,result.password);
            if(isValidPassword==true){
              db.run(sqlQuery,(err,result)=>{
                if(err) console.log('Query error - updating user: ',err);
                else{
                  res.status(200).json({'messsage':'User updated'});
                }
              });
            }else{
              res.send({'message':'Incorrect Password'});
            }
          }else{
            res.send({'message':'Mobile number not found'});
          }
        }
      );
    }
  });
  }
});

//fetch all users in the database
app.get('/api/all-users', (req,res)=>{
  db.serialize((err)=>{
    if(err){
      console.log('Error connecting database ', err);
    }else{
    db.all('SELECT * FROM users;', (err,result)=>{
      if(err){
        console.log('Error fetching data ',err);
      }
      res.status(200).json({
        'status':true,
        'data':result
      });
    });
    }
  });
});

// this api expects (user_id, restaurant (name*,address*,city*,phone1*,phone2,type*,ethnicity*,table_capacity*,service_type*,location))
// user_type should be 'owner' to register a restaurant
app.post("/api/register-restaurant", (req,res)=>{
  const data = req.body;

  db.serialize((err)=>{
    if(err){
      console.log("Connection Error: ",err);
      res.status(500).json({error: "Database Connection error"});
    }else{
      // check if the requested user is 'owner'
      db.get(`SELECT user_type FROM users WHERE id=${data.user_id}`,(err,result)=>{
        if(err){
          console.log('Query Error: ',err);
          return res.status(500).json({error:"Database Query error"});
        }else{
          if(result.user_type=='owner'){
            //Create SQL query with parameterized values
            const sqlQuery = `INSERT INTO restaurants (name, address, city, state, phone1, phone2, type, ethnicity, table_capacity, service_type, location, owner) 
                                VALUES ('${data.name}','${data.address}','${data.city}','${data.state}',${data.phone1},${data.phone2 ? data.phone2 : null},'${data.type}',
                                '${data.ethnicity ? data.ethnicity : null}',${data.table_capacity},'${data.service_type}','${data.location ? data.location : null}',${data.user_id});`;
            
            db.serialize((err)=>{
              if(err){
                console.log('Error connecting for insert into restaurant: ',err);
              }
              db.run(sqlQuery, (err, result) => {
                if (err) {
                  console.log("Query Error: ", err);
                  return res.status(500).json({ error: "Database Query error" });
                } else {
                  res.status(200).json({ message: "Restaurant registered" });
                }
              });
            });
          }else{
            res.json({data:result ,message:'You are not eligible to register a restaurant.'});
          }
        }
      });
    }
  });

  
});

// update restaurant information
app.post('/api/update-restaurant', (req,res)=>{
  const data = req.body;
  const sqlQuery = `UPDATE restaurants SET ${data.name ? `name='${data.name}',` : ''}
                                           ${data.address ? `address='${data.address}',` : ''}
                                           ${data.city ? `city='${data.city}',`:''}
                                           ${data.state ? `state='${data.state}',`:''}
                                           ${data.phone1 ? `phone1=${data.phone1},`:''}
                                           ${data.phone2 ? `phone2=${data.phone2},`:''}
                                           ${data.type ? `type='${data.type}',`:''}
                                           ${data.ethnicity ? `ethnicity='${data.ethnicity}',`:''}
                                           ${data.table_capacity ? `table_capacity=${data.table_capacity},`:''}
                                           ${data.service_type ? `service_type='${data.service_type}',`:''}
                                           ${data.location ? `location='${data.location}',`:''}
                                           owner=${data.user_id}
                                      WHERE id=${data.id};`;
  db.serialize((err)=>{
    if (err) {console.log("Connection error", err);return res.status(500).json({ 'error': err });}
  
    db.run(sqlQuery,(err,result)=>{
      if (err) {
        console.log(err);
      }
      res.status(200).json({'status':true,'message':'Restaurant Updated Sussessfully'});
    });
  });
});

// get restaurant by id
app.get('/api/get-restaurant/:id',(req,res)=>{
  db.serialize((err)=>{
    if(err){console.log("Connection Error- Connectiong to fetch restaurant: \n ",err)}
    else{
      db.get(`SELECT * FROM restaurants WHERE id=${req.params.id};`,(err,result)=>{
        if(err){
          console.log('Query Error- Querying to fetch restaurant by id: \n',err);
        }else{
          res.status(200).json({
            status:true,
            data:result,
          });
        }
      });
    }
  });
});


// post restaurants list based on filter
app.post("/api/restaurants", (req, res) => {
  const filter = req.body;
  // Prepare SQL query with parameterized values
  const sqlQuery = `SELECT * FROM restaurants WHERE 1=1 
                    ${filter.name ? `AND name LIKE '%${filter.name}%'` : ''}
                    ${filter.city ? `AND city LIKE '${filter.city}'` : ''}
                    ${filter.type ? `AND type='${filter.type}'` : ''}
                    ${filter.ethnicity ? `AND ethnicity='${filter.ethnicity}'` : ''}
                    ${filter.table_capacity ? `AND table_capacity >= ${filter.table_capacity}` : ''}
                    ${filter.service_type ? `AND service_type='${filter.service_type}'` : ''}`;
    db.serialize((err) => {
      if (err) {console.log("Connection error", err);return res.status(500).json({ error: "Database connection error" });}
      db.all(sqlQuery,(err, result) => {
          if (err) {
            console.log(err);
            return res.status(500).json({ error: "Database query error" });
          }else{
            res.json({
              length:result.length,
              data:result,
            });
          }
        }
      );
    });
  });

// get all restaurants
app.get('/api/all-restaurants',(req,res)=>{
  db.serialize((err)=>{
    if(err){
      console.log('Error connecting', err)
    }
    db.all('SELECT * FROM restaurants;', (err,result)=>{
      if(err){
        console.log('Error fetching restaurants: ',err);
      }
      res.status(200).json({'status':true,'data':result});
    });
  });
});

//create menu item for a particular restaurant
app.post('/api/create-menu', upload.single('image'),(req,res)=>{
  const formdata = req.body;
  const image = req.file;

  db.serialize((err)=>{
    if(err)console.log('Menu create: Connection Error: ',err);
    else{
      db.run(`INSERT INTO menu (type,food_item,food_desc,price,food_image_url,restaurant_id) VALUES(
        '${formdata.type}','${formdata.food_item}','${formdata.food_desc}',${formdata.price},'${image.path}',${formdata.restaurant_id});`,(err,result)=>{
          if(err) res.status(500).json({'Error':err,'result':result});
          else{
            res.status(200).json({'message':'Menu Item created'});
          }
        });
    }
  });
});

// get menu list from the restaurant id
app.get('/api/menu/:id',(req,res)=>{
  const id = req.params.id;
  db.serialize((err)=>{
    if (err) console.log("Menu get: Connection Error: ", err);
    db.all(
      `SELECT * FROM menu WHERE restaurant_id=${id};`,(err,result)=>{
        if(err) {res.send(err);}
        else{res.json({
          status:true,
          length:result.rowCount,
          data:result.rows
        });}
      }
    );
  });
});

//update menu item with provided menu id
app.post('/api/update-menu', upload.single('image'),(req,res)=>{
  const formdata = req.body;
  const foodImage = req.file;
  const sqlQuery = `UPDATE menu SET ${formdata.food_item? `food_item='${formdata.food_item}'`:''}
                                    ${formdata.food_desc? `, food_desc='${formdata.food_desc}'`:''}
                                    ${formdata.type? `, type='${formdata.type}'`:''}
                                    ${formdata.price? `, price=${formdata.price}`:''}
                                    ${foodImage? `, food_image_url='${foodImage.path}'`:''} WHERE id=${formdata.id};`
  
  db.serialize((err)=>{
    if(err){
      res.status(500).json({'error_type':'update menu error connection: ','error': err});
    }else{
      db.run(sqlQuery,(err,result)=>{
        if(err){
          res.status(500).json({'error_type':'Update menu query error','error': err});
        }else{
          res.status(200).json({'response':'Menu Item Updated'});
        }
      });
    }
  });
});

app.get('/api/get-bookings/:id',(req,res)=>{
  const sqlQuery = `SELECT * FROM bookings WHERE user_id=${req.params.id} ORDER BY visit_date DESC;`;
  db.serialize((err)=>{
    if (err) console.log("Connection Error: ", err);
    db.all(sqlQuery,(err,result)=>{
      if(err) res.send(err);
        else{
          res.json({
          length:result.rowCount,
          data:result.rows
        });
      }
    });
  });
});

app.post('/api/booking',(req,res)=>{
  const data = req.body;
  db.serialize((err)=>{
    if (err) console.log("Connection Error: ", err);
    db.run(
      `INSERT INTO bookings (user_id, restaurant_id, restaurant_name, table_no, details, guests, booking_date, visit_date, visit_time) 
      VALUES (${data.user_id}, ${data.restaurant_id}, '${data.restaurant_name}', ${data.table_no}, '${data.details}', ${data.guests},'${data.booking_date}',
      '${data.visit_date}', '${data.visit_time}');`,(err,result,fields)=>{
        if(err) res.send(err);
        else{res.status(200).json({
          'message':'A table has been booked for you. We welcome your visit.',
          'status':result.rows
        });}
      }
    );
  });
});

app.post('/api/add-review', (req,res)=>{
  const data = req.body;
  db.serialize((err)=>{
    if(err) console.log('Connection Error: ',err);
    else{
      db.run(
        `INSERT INTO reviews (user_id, restaurant_id, review, rating) VALUES (${data.user_id},${data.restaurant_id},'${data.review}',${data.rating});`
      ,(err,result)=>{
        if(err){res.status(500).json({'error':err,'error_details':'Review add error'})}
        else{
          res.status(200).json({'Result':'Review Added'});
        }
      });
    }
  });
});


const server = ()=> app.listen(port,function(){
    console.log(`Listening on port ${port}`);
});

const wsServer = new ws({httpServer:server});