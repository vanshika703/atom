const express = require('express')
const app = express()
const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId
const session = require('express-session')
const bcrypt = require('bcryptjs')
const ejs = require('ejs')
const dotenv = require('dotenv')
dotenv.config()
const {registerValidation,loginValidation} = require('./validation')


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

app.get("/admin/login", (req,res) => {
    res.render("adminlogin",{msg:''})
})

app.get("/admin/register", (req,res) => {
    res.render("adminregister",{msg:''})
})

app.post('/adminRegister', (req,res) => {
    
    mongoClient.connect(url, {useUnifiedTopology:true}, (err,db) => {
        if(err) throw err

        const salt = bcrypt.genSaltSync(10)
        const hashed = bcrypt.hashSync(req.body.password,salt)

        let newData = {
            name:req.body.name,
            email:req.body.email,
            password: hashed
        }

        let dbo = db.db('atom')

        dbo.collection('admin').insertOne(newData, (dbErr,result) => {
            if(dbErr) throw dbErr

            console.log("inserted"+result.insertedCount)
            res.status(200).send("Registered!")
        })
    })
})

app.post('/adminLogin', (req,res) => {

    mongoClient.connect(url, {useUnifiedTopology:true} , (err,db) => {
        let dbo = db.db('atom')

        dbo.collection('admin').find({email:req.body.email}).toArray((dbErr,result) => {
            if(!result.length || !bcrypt.compareSync(req.body.password,result[0].password))
                return res.status(400).send("Email/Password is wrong")

            res.status(200).send("logged in")
        })
    })
})

var PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log("server up at 5000"))