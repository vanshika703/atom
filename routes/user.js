const Router = require('express').Router()

const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId

const bcrypt = require('bcryptjs')
const nodemailer = require('nodemailer')
const fetch = require('node-fetch')

const {OAuth2Client} = require('google-auth-library')
const client = new OAuth2Client("523384873779-e29ttamvfnbfkhb650ppufoas5qmr328.apps.googleusercontent.com")

const { loginValidation,registerValidation } = require('../validation')

let host
let rand

Router.get('/', (req,res)=>{
    res.render('user/register')
})

Router.post('/register', async(req,res)=>{

    const { email,password,captcha } = req.body

    if(!captcha){
        return res.status(400).json({"msg":"Please select captcha"})
    }

    const secretKey = '6Lfie_kUAAAAAAYZM0z0uetf7cs8pFQ4_e567GmN'

    const verifyUrl = `https://google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captcha}&remoteip=${req.connection.remoteAddress}`

    let result = await fetch(verifyUrl)
    let data = await result.json()

    if(!data.success) return res.status(400).json({"msg":"Failed captcha verification! Please reload the page and try again"})

    let { error } = registerValidation({ email,password })
    if(error) return res.status(400).json({msg:error.details[0].message})

    let db = req.app.locals.db
    let dbo = db.db("atom")

    dbo.collection('users').findOne({email}, async(err, user)=>{
        if(err) return res.render('error')

        //if user exists
        if(user)
            return res.status(400).json({msg:"This email is already registered!"})
        else{
            //hashing password
            const salt = await bcrypt.genSalt(10)
            const hashedPassword = await bcrypt.hash(password, salt)

            //new user info
            let userInfo = {
                email,
                password : hashedPassword,
                userType : 0,
                verified : 0,
                registered : 0
            }

            dbo.collection('users').insertOne(userInfo, (dbErr,result)=>{
                if(dbErr) return res.render('error')

                host = req.get('host')
                rand = result.insertedId
                link = "http://"+req.get('host')+"/user/verify?id="+rand;

                let transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL,
                        pass: process.env.PASSWORD
                    },
                    tls:{
                        rejectUnauthorized:false
                    }
                });
                
                let mailOptions = {
                    from: process.env.EMAIL,
                    to: email,
                    subject: 'Confirmation email for Tdian register',
                    html: "<p>link is...<a href="+link+">Click here to verify....</a></p>"
                };
                
                transporter.sendMail(mailOptions, function(error, info){
                    if (error) {
                        console.error(error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });

                res.json({msg:"Check email for verification link"})
            })
        }
    })    
})

Router.get('/verify', (req,res) => {

    console.log("link :"+req.protocol+":/"+req.get('host'))

    if((req.protocol+"://"+req.get('host'))==("http://"+host)) {
        console.log("Domain matched")

        let db = req.app.locals.db
        let dbo = db.db('atom')

        dbo.collection('users').findOne({_id : new ObjectId(req.query.id)}, (dbErr, user)=>{
            if(dbErr) return res.render('error')
            
                if(!user) return res.send('No such user found')

                dbo.collection('users').updateOne({_id : new ObjectId(req.query.id)}, { $set: {verified : 1} }, async(err, result)=>{
                    if(err) return res.render('error')

                    console.log(result.modifiedCount)
                    res.redirect('/user/login')
                })
            }) 
    } 
    else {
        res.status(404).send('Error 404')
    }
})

Router.get('/login', (req,res)=>{
    res.render('user/login')
})


Router.get('/dash',async(req,res) => {
    let user = {
        name:'Arindam',
        id:'5ebfd0562f97d128fcb82780'
    }
    
    let db = req.app.locals.db

    try {
        //all tasks the user is involved in
        let tasks = await db.db('atom').collection('tasks').find({'members.id':user.id}).toArray()

        res.render('user/userdashboard',{tasks,user})
    } catch (error) {
        console.error(error)
        return res.render('error')
    }
})

Router.get('/project/:id',async(req,res) => {
    let user = {
        name:'Arindam',
        id:'5ebfd0562f97d128fcb82780'
    }
    let { id } = req.params

    let db = req.app.locals.db

    try {
        //finding the task that is requested
        let task = await db.db('atom').collection('tasks').findOne({_id:new ObjectId(id)})

        //subtasks of the user in that task
        let subtasks = await db.db('atom').collection('subtasks').find({project:id,member:user.id}).toArray()

        let completed = 0

        subtasks.forEach(subtask => {
            if(subtask.complete) completed++
        })

        task.subtasks = subtasks
        task.percentage = Math.round((completed/subtasks.length)*100)

        res.render('user/userproject',{task,user})

    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.put('/update/:id',async(req,res) => {
    let { id } = req.params

    let db = req.app.locals.db

    try {
        await db.db('atom').collection('subtasks').updateOne({_id:new ObjectId(id)},{$set:{complete:true}})
        res.json({msg:'Updated'})
    } catch (error) {
        console.error(error)
        return res.status(500).json({msg:'Server Error!'})
    }

})

function auth(req,res,next){
    let token = req.body.token

    if(!token) return res.status(401).json({msg:'not authorized'})

    jwt.verify(token,process.env.TOKEN_SECRET,(err,user) => {
        if(err) return res.status(400).json({msg:'token does not match'})

        req.userId = user.id
        req.userType = user.type
        next()
    })
}

module.exports = Router