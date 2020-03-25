const express = require('express')
const app = express()

const Joi = require('@hapi/joi')

const dotenv = require('dotenv')
dotenv.config()

const bcrypt = require('bcryptjs')

const mongoClient = require('mongodb').MongoClient

const nodemailer = require('nodemailer')


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
    res.sendFile(__dirname+"/register.html")
})

let rand,host;

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
                password : hashedPassword,
                verified : 0
                }
                dbo.collection('user').insertOne(userInfo, (dbErr,result)=>{
                    if(dbErr) throw dbErr

                    rand = Math.floor( ( Math.random() * 100) + 54 )
                    host = req.get('host')
                    link = "http://"+req.get('host')+"/verify?id="+rand;

                    let transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                          user: 'vanshi.loveart@gmail.com',
                          pass: 'vanshika419'
                        },
                        tls:{
                          rejectUnauthorized:false
                        }
                    });
                      
                    let mailOptions = {
                        from: 'vanshi.loveart@gmail.com',
                        to: req.body.email,
                        subject: 'Sending Email using Node.js',
                        text: 'That was easy!',
                        html: "<p>link is...<a href="+link+">Click here to verify</a></p>"
                    };
                      
                    transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                          console.log(error);
                        } else {
                          console.log('Email sent: ' + info.response);
                        }
                    });

                    res.send("Check email for otp")
                })
            }
        })
        
    })
    
})

app.get('/verify', (req,res) => {

    console.log(req.protocol+":/"+req.get('host'))
    if((req.protocol+"://"+req.get('host'))==("http://"+host))
    {
        console.log("Domain matched")
        if(req.query.id==rand)
        {
            res.send("Email verified")
        }
         else {
        console.log("Email not verified")
        }
    } else {
        res.send("request from unknown source")
    }

})

app.listen(3000, (err)=>{
    if(err) throw err
    console.log("App running on 3000")
})