const Router = require('express').Router()
const mongodb = require('mongodb')
const ObjectId = mongodb.ObjectId
const bcrypt = require('bcryptjs')
const {adminloginValidation,changePasswordValidation} = require('../validation')

Router.get('/', (req,res) => {
    res.render('admin/adminlogin',{msg:''})
})

Router.get('/register', (req,res) => {
    res.render('admin/adminregister',{msg:''})
})

Router.post('/register', (req,res) => {
    
    const salt = bcrypt.genSaltSync(10)
    const hashed = bcrypt.hashSync(req.body.password,salt)

    let newData = {
        name:req.body.name,
        email:req.body.email,
        password: hashed
    }

    let db = req.app.locals.db
    let dbo = db.db('atom')

    dbo.collection('admins').insertOne(newData, (dbErr,result) => {
        if(dbErr) return res.render('error')

        console.log('inserted'+result.insertedCount)
        res.status(200).send('Registered!')
    })
})


Router.post('/login', (req,res) => {

    let {error} = adminloginValidation(req.body)
    if(error) return res.status(400).send(error.details[0].message)

    let db = req.app.locals.db
    let dbo = db.db('atom')

    dbo.collection('admins').find({email:req.body.email}).toArray((dbErr,result) => {
        if(dbErr) return res.render('error')

        if(!result.length || !bcrypt.compareSync(req.body.password,result[0].password)) return res.status(400).send('Email/Password is wrong')

        req.session.user = {
            name:result[0].name,
            email:result[0].email,
            id:result[0]._id,
            type:result[0].adminType
        }

        req.session.user.expires = new Date(
            Date.now() + 1000 * 60 * 60 * 2
        )
        res.end()
    })
})

//middleware for authentication
Router.use((req,res,next) => {
    if(req.session.user) next()
    else res.render('admin/adminlogin',{msg:'Please login to continue'})
})

//middleware to prevent caching for better logout
Router.use(function (req, res, next) {
    res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.header('Expires', '-1');
    res.header('Pragma', 'no-cache');
    next()
});

Router.get('/dashboard', async(req,res) => {
    let db = req.app.locals.db

    try {
        let dbo = db.db('atom')
        let members = await dbo.collection('users').find({ userType: 1 },{projection:{password:0}}).toArray()
        res.render('admin/admindashboard',{user:req.session.user, data:members })
    } catch (error) {
        console.error(error)
        return res.render('error')
    }
})


Router.get('/changePassword', (req,res) => {
    res.render('admin/adminchangepassword',{user:req.session.user})
})

Router.post('/changePassword',(req,res) => {

    let {error} = changePasswordValidation(req.body)
    if(error) return res.status(400).send(error.details[0].message) 
    
    let db = req.app.locals.db
    let dbo = db.db('atom')
    
    dbo.collection('admins').findOne({_id:new ObjectId(req.session.user.id)},(dbErr,user) => {
        if(dbErr) return res.render('error')
        
        if(!bcrypt.compareSync(req.body.currentPassword,user.password)) return res.status(400).send('Current Password is incorrect')
        
        const salt = bcrypt.genSaltSync(10)
        const hashed = bcrypt.hashSync(req.body.newPassword,salt)
        dbo.collection('admins').updateOne({_id:new ObjectId(req.session.user.id)},{$set:{password:hashed}}, (dbErr,result) => {
            if(dbErr) return res.render('error') 
            
            console.log(result)
            res.send('Password Updated')
        })
    })
})

Router.post('/addEvent',(req,res) => {
    
    req.body.addedBy = req.session.user.name
    let date = new Date().toString().substring(4,15)
    req.body.addedOn = date

    let db = req.app.locals.db
    let dbo = db.db('atom')

    dbo.collection('events').insertOne(req.body,(dbErr,result) => {
        if(dbErr) return res.status(500).json({msg:'Server Error! Please try again later.'})
        
        console.log(result.insertedCount)
        res.json({msg:'Event added'})
    })
})

Router.get('/viewEvents', (req,res) => {
    
    let db = req.app.locals.db
    let dbo=db.db('atom')

    dbo.collection('events').find({}).toArray((dbErr,data) => {
        if(dbErr) return res.render('error')

        res.render('admin/adminviewevents',{data,user:req.session.user})
    })
})

Router.get('/viewFeedback/:id',async(req,res) => {
    
    let db = req.app.locals.db
    try {
        let event = await db.db('atom').collection('events').findOne({_id:new ObjectId(req.params.id)})
        res.render('admin/viewfeedback',{event,user:req.session.user})
        
    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.get('/viewAttendance/:id',async(req,res) => {
    
    let db = req.app.locals.db
    try {
        let event = await db.db('atom').collection('events').findOne({_id:new ObjectId(req.params.id)})
        res.render('admin/viewattendance',{event,user:req.session.user})
        
    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.get('/viewProjects', async(req,res) => {
    let db = req.app.locals.db
    
    try {
        //all tasks
        let tasks = await db.db('atom').collection('tasks').find({}).toArray()
        tasks = tasks.reverse()
        
        res.render('admin/adminviewprojects',{data:tasks,user:req.session.user})
    } catch (error) {
        console.error(error)
        return res.render('error')
    }
})

Router.get('/viewproject/:id',async(req,res) => {
    let db = req.app.locals.db
    let { id } = req.params

    try {
        let project = await db.db('atom').collection('tasks').findOne({_id:new ObjectId(id)})
        if(!project) return res.render('error')

        let subtasks = await db.db('atom').collection('subtasks').find({project:id}).toArray()
        let bugs = await db.db('atom').collection('bugs').find({project:id}).toArray()

        let done_bugs = bugs.reduce((count,bug) => bug.complete?count+1:count,0)
        let done = subtasks.reduce((count,sub) => sub.complete?count+1:count,done_bugs)
        project.percentage = Math.round((done/(subtasks.length+bugs.length))*100)

        project.members.forEach(member => {
            let current_subs = subtasks.filter(subtask => subtask.member===member.id)
            let current_bugs = bugs.filter(bug => bug.member===member.id)
            member.subtasks = current_subs
            member.bugs = current_bugs
            let completed_bugs = current_bugs.reduce((count,bug) => bug.complete?count+1:count,0)
            let completed = current_subs.reduce((count,sub) => sub.complete?count+1:count,completed_bugs)
            member.percentage = Math.round((completed/(current_subs.length+current_bugs.length))*100)
        })
        res.render('admin/viewproject',{project,user:req.session.user})
    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.get('/viewMembers', (req,res) => {
    
    let db = req.app.locals.db
    let dbo= db.db('atom')

    dbo.collection('users').find({ userType: 1,registered:1 },{projection:{password:0}}).toArray((dbErr, tdians) => {
        if (dbErr) return res.render('error')
        
        res.render('admin/adminviewmembers',{data:tdians,user:req.session.user})
    })
})

Router.get('/viewUsers', (req,res) => {
    let db = req.app.locals.db
    db.db('atom').collection('users').find({userType:0,registered:1},{projection:{password:0}}).toArray((dbErr,ntdians) => {
        if(dbErr) return res.render('error')

        res.render('admin/adminviewusers',{data:ntdians,user:req.session.user})
    })
})

Router.get('/viewprofile/:id', (req,res) => {
    let db = req.app.locals.db
    db.db('atom').collection('users').findOne({_id:new ObjectId(req.params.id)},{projection:{password:0}},(dbErr,user) => {
        if(dbErr) return res.render('error')

        res.render('admin/adminviewprofile',{user,admin:req.session.user})
    })
})

Router.get('/viewmemberprofile/:id', (req,res) => {
    let db = req.app.locals.db
    db.db('atom').collection('users').findOne({_id:new ObjectId(req.params.id)},{projection:{password:0}},(dbErr,user) => {
        if(dbErr) return res.render('error')

        res.render('admin/adminviewmemberprofile',{user,admin:req.session.user})
    })
})

Router.post('/delete', (req,res) => {
    let id = req.body.id
    let from = req.query.from
    let coll = `${from}_garbage`
    
    let db = req.app.locals.db
    db.db('atom').collection(from).findOneAndDelete({_id:new ObjectId(id)},(dbErr,deleted) => {
        if(dbErr) return res.render('error')
        
        console.log(deleted.value)

        db.db('atom').collection(coll).insertOne(deleted.value, (error,result) => {
            if(error) return res.render('error')

            console.log(result.insertedCount)
        })
        res.send({msg:'deleted'})
    })
})

Router.post('/promote', (req,res) => {
    let {id,domain} = req.body

    let db = req.app.locals.db
    db.db('atom').collection('users').updateOne({_id:new ObjectId(id)},{$set:{userType:1,domain}},(dbErr,result) => {
        if(dbErr) return res.render('error')
        
        console.log(result.modifiedCount)
        res.send({msg:'User promoted!'})
    })
})

Router.get('/addTask',(req,res) => {
    
    let db = req.app.locals.db
    let dbo= db.db('atom')

    dbo.collection('users').find({ userType: 1 },{projection:{password:0}}).toArray((dbErr, tdians) => {
        if (dbErr) return res.render('error')
        
        res.render('admin/adminaddtask',{data:tdians,user:req.session.user})
    })
})

Router.post('/addTask',async(req,res) => {
    let {
        title,
        startDate,
        deadline,
        description,
        phases,
        members,
        resources,
        subtasks
    } = req.body

    let project = { title, startDate, deadline, description, phases, members, resources }
    project.addedBy = req.session.user.name
    let date = new Date().toString().substring(4,15)
    project.addedOn = date

    let db = req.app.locals.db
    db.db('atom').collection('tasks').insertOne(project,(dbErr,result) => {
        if(dbErr) return res.json({msg:'Server error'})

        console.log('Project: '+result.insertedCount)
        subtasks.forEach(subtask => {
            subtask.project = result.insertedId.toString()
        })

        db.db('atom').collection('subtasks').insertMany(subtasks, (err,output) => {
            if(err) return res.json({msg:'Server error'})

            console.log(output.insertedCount)
            res.send({msg:'Project added. Refresh the page to clear out the form'})
        })
    })
})

Router.get('/editEvent',(req,res) => {
    let db = req.app.locals.db

    db.db('atom').collection('events').findOne({_id:new ObjectId(req.query.id)},(err,event) => {
        if(err) return res.render('error')

        res.render('admin/admineditevent',{event,user:req.session.user})
    })
})

Router.post('/editEvent',(req,res) => {
    req.body.editedBy = req.session.user.name
    let date = new Date().toString().substring(4,15)
    req.body.editedOn = date
    let db = req.app.locals.db
    let {id} = req.body
    delete req.body.id

    db.db('atom').collection('events').updateOne({_id:new ObjectId(id)},{$set:req.body},(err,result) => {
        if(err) return res.json({msg:'Server error!'})

        console.log(result)
        res.json({msg:'Updated!'})
    })
})

Router.get('/editProject',async(req,res) => {
    let db = req.app.locals.db

    try {
        let project = await db.db('atom').collection('tasks').findOne({_id:new ObjectId(req.query.id)})
        res.render('admin/editproject',{project,user:req.session.user})
    } catch (error) {
        console.error(error)
        return res.render('error')
    }
})

Router.post('/editProject',async(req,res) => {
    req.body.editedBy = req.session.user.name
    let date = new Date().toString().substring(4,15)
    req.body.editedOn = date
    let db = req.app.locals.db
    let {id,bugs} = req.body
    if(bugs.length > 0) bugs.forEach(bug => bug.project = id)
    delete req.body.id
    delete req.body.bugs

    try {
        await db.db('atom').collection('tasks').updateOne({_id:new ObjectId(id)},{$set:req.body})
        if(bugs.length === 0) return res.json({msg:'updated'})
        await db.db('atom').collection('bugs').insertMany(bugs)
        return res.json({msg:'updated'})
    } catch (error) {
        console.error(error)
        return res.render('error')
    }
})

Router.put('/updateContact/:id/:number', async(req,res) => {
    let { db } = req.app.locals
    let { id, number } = req.params

    try {
        await db.db('atom').collection('users').updateOne({_id:new ObjectId(id)},{$set:{contactno:number}})
        res.json({msg:'Updated!'})
    } catch (error) {
        console.error(error)
        res.status(500).json({msg:'Server error! Please refresh and try again!'})
    }
})

Router.put('/updateWhatsapp/:id/:number', async(req,res) => {
    let { db } = req.app.locals
    let { id, number } = req.params

    try {
        await db.db('atom').collection('users').updateOne({_id:new ObjectId(id)},{$set:{whatsappno:number}})
        res.json({msg:'Updated!'})
    } catch (error) {
        console.error(error)
        res.status(500).json({msg:'Server error! Please refresh and try again!'})
    }
})

Router.all('/logout', (req,res) => {
    req.session.destroy()
    res.render('admin/adminlogin',{msg : 'You have been logged out!'})
})

//extras for super admin
Router.get('/viewAdmins',async(req,res) => {
    if(!req.session.user.type) return res.status(401).json({msg:'Not authorised!'})

    let db = req.app.locals.db

    try {
        let admins = await db.db('atom').collection('admins').find({},{projection:{password:0}}).toArray()
        
        res.render('admin/viewadmins',{data:admins,user:req.session.user})
    } catch (error) {
        console.error(error)
        return res.render('error')
    }
})

Router.get('/viewadminprofile/:id', async(req,res) => {
    if(!req.session.user.type) return res.status(401).json({msg:'Not authorised!'})

    let db = req.app.locals.db

    try {
        let user = await db.db('atom').collection('admins').findOne({_id:new ObjectId(req.params.id)},{projection:{password:0}})
        res.render('admin/viewadminprofile',{user,admin:req.session.user})
    } catch (error) {
        console.error(error)
        res.render('error')
    }
})

Router.post('/promoteMember',async(req,res)=> {
    if(!req.session.user.type) return res.status(401).json({msg:'Not authorised!'})

    let db = req.app.locals.db
    let { id } = req.body
    try {
        let user = await db.db('atom').collection('users').findOneAndDelete({_id: new ObjectId(id)})
        
        user.value.adminType = 0
        await db.db('atom').collection('admins').insertOne(user.value)
        res.json({msg:'Member promoted!'})

    } catch (error) {
        console.error(error)
        return res.status(500).json({msg:'Server error! Please refresh and try again!'})
    }
})

Router.post('/demoteAdmin',async(req,res)=> {
    if(!req.session.user.type) return res.status(401).json({msg:'Not authorised!'})

    let db = req.app.locals.db
    let { id } = req.body
    try {
        let admin = await db.db('atom').collection('admins').findOneAndDelete({_id: new ObjectId(id)})
        
        delete admin.value.adminType
        await db.db('atom').collection('users').insertOne(admin.value)
        res.json({msg:'Admin demoted!'})

    } catch (error) {
        console.error(error)
        return res.status(500).json({msg:'Server error! Please refresh and try again!'})
    }
})

module.exports = Router