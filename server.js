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

// app.use(bodyParser.urlencoded({extended:true}));

// root site
app.get('/', function(req,res){
    res.sendFile(__dirname + '/public/home.html');
});

app.get('/')


app.post("/api/login",(req,res)=>{
    const mobile = parseInt(req.body.mobile);
    db.connect((err)=>{
        if(err) console.log("Connection Error: ",err);
        db.query(
            `SELECT id, name, username, email, mobile FROM users WHERE mobile=${mobile};`,(err,result,fields)=>{
            db.release();
            if(err) res.send('Query Error', err);
                res.json(result);
            }
        );
    });
});

app.get("/api/user/:id", (req,res)=>{
  const id = parseInt(req.params.id);
  db.connect((err)=> {
    if(err) console.log('Connection Error: ',err);
    db.query(
      `SELECT * FROM users WHERE id=${id};`,(err,result,fields)=>{
        if(err) res.send(err);
        res.json(result);
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


app.listen(port,function(){
    console.log(`Listening on port ${port}`);
});