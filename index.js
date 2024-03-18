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


connection.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50),
    mobile BIGINT NOT NULL UNIQUE,
    address VARCHAR(200),
    user_type VARCHAR(20) CHECK (user_type IN ('admin', 'sub-admin', 'staff', 'manager', 'customer', 'owner'))
);`,(err,result)=>{
    if(err)console.error('Query Error',err);
});

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