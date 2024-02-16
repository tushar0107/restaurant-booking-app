const express = require('express');
const http = require('http');
const mysql = require("mysql");

const app = express();
const bodyParser = require('body-parser');

const port = 8000;

// connection to database
const db = mysql.createConnection({
    host: "localhost",
    user: "user",
    password: "Tushar@1701",
    database: "restro",
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
                  else res.send(result);
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
          else res.send(result); 
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
        res.send(result);
      }
    )
  });
});

app.get("/api/restaurants", (req, res) => {
    db.connect((err) => {
      if (err) console.log("Connection error", err);
      db.query(
        `SELECT * FROM restaurant;`,(err, result, fields) => {
          if (err) res.send(err);
          res.json({
            length:result.length,
            data:result
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
          length:result.length,
          data:result
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
          data:result
        });
      }
    );
  });
});

// app.post('/api/add-review', (req,res)=>{
//   const data = req.body;
//   db.connect((err)=>{
//     if(err) console.log('Connection Error: ',err);
//     else{
//       db.query(
//         `INSERT INTO reviews (user_id, restaurant_id, review, )`
//       )
//     }
//   })
// });


app.listen(port,function(){
    console.log(`Listening on port ${port}`);
});