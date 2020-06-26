const Joi = require('@hapi/joi')

const adminloginValidation = data => {
    const schema = Joi.object({
        email:Joi.string().required().email(),
        password:Joi.string().min(8).required()
    })

    return schema.validate(data)
}

const changePasswordValidation = data => {
    const schema = Joi.object({
        currentPassword:Joi.string().min(8).required(),
        newPassword:Joi.string().min(8).required().disallow(Joi.ref('currentPassword')).error((err) => {
            if(err[0].code==='any.invalid')
                err[0].message = "New Password must be different from current password"
            return err
        })
    })

    return schema.validate(data)
}

const loginValidation = data => {
    const schema = Joi.object({
        email:Joi.string().required().email(),
        password:Joi.string().min(8).required()
    })

    return schema.validate(data)
}

const registerInfoValidation = data => {
    const schema = Joi.object({
        name : Joi.string().min(3).required(),
        regno : Joi.string().required().min(15).max(15),
        dept : Joi.string().min(3).required(),
        year : Joi.required(),
        batch : Joi.required(),
        contactno : Joi.string().min(10).max(10).required(),
        whatsappno : Joi.string().min(10).max(10).required(),
        domain1 : Joi.required(),
        domain2 : Joi.required().disallow(Joi.ref('domain1')).error((err) => {
            if(err[0].code==='any.invalid')
                err[0].message = "Both Domains should be different"
            return err
        })
    })
    return schema.validate(data)
}

module.exports.loginValidation = loginValidation
module.exports.registerInfoValidation = registerInfoValidation
module.exports.changePasswordValidation = changePasswordValidation
module.exports.adminloginValidation = adminloginValidation