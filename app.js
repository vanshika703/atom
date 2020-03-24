const express = require('express')
const app = express()

const Joi = require('@hapi/joi')

const dotenv = require('dotenv')
dotenv.config()

const bcrypt = require('bcryptjs')

const mongoClient = require('mongodb').MongoClient



const schema = Joi.object({
    name : Joi.string().min(3).required(),
    email : Joi.string().required().email(),
    regno : Joi.string().required().min(15).max(15),
    password : Joi.string().min(8).required(),
    dept : Joi.string().min(3).required(),
    year : Joi.required(),
    domain : Joi.required()
})

app.use(express.urlencoded({extended:false}))
app.use(express.json())

app.get('/', (req,res)=>{
    res.sendFile(__dirname+"/index.html")
})

app.post('/register', (req,res)=>{

    let { error } = schema.validate(req.body)
    if(error) return res.send(error.details[0].message)

    mongoClient.connect(process.env.DB_CONNECT, { useUnifiedTopology: true }, (err,db)=>{
        if(err) throw err
        let dbo = db.db("register")

        dbo.collection('user').findOne({email : req.body.email}, async(dbErr, user)=>{
            if(dbErr) throw dbErr

            //if user exists
            if(user)
                res.send("Email exists")
            else{
                //hashing password
                const salt = await bcrypt.genSalt(10)
                const hashedPassword = await bcrypt.hash(req.body.password, salt)

                //new user info
                let userInfo = {
                name : req.body.name,
                email : req.body.email,
                regno : req.body.regno,
                dept : req.body.dept,
                year : req.body.year,
                domain : req.body.domain,
                password : hashedPassword
                }
                dbo.collection('user').insertOne(userInfo, (dbErr,result)=>{
                    if(dbErr) throw dbErr
                    res.redirect('/')
                })
            }
        })
        
    })
    
})

app.listen(3000, (err)=>{
    if(err) throw err
    console.log("App running on 3000")
})