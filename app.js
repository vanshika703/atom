const express = require('express')
const app = express()
const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId
const session = require('express-session')
const bcrypt = require('bcryptjs')
const ejs = require('ejs')
const dotenv = require('dotenv')
dotenv.config()


app.use(express.urlencoded({extended:false}))
app.use(express.json())
app.use(session({
    secret:"dsudbfusidncs",
    resave:true,
    saveUninitialized:false
}))
app.use(express.static(__dirname + '/views'))
app.set("view engine","ejs")

const mongoClient = mongodb.MongoClient
const url = process.env.DB_URL

app.get("/", (req,res) => {
    res.render("login")
})

app.get('/register', (req,res) => {
    res.render('register')
})

app.post('/login', (req,res) => {
    res.send(req.body)
})

var PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log("server up at 5000"))