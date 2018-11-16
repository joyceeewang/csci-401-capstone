var express = require('express');
var router = express.Router();
var Form = require('../models/form');
var nodemailer = require('nodemailer');
var credentials = require('../config/auth');
var googleAuth = require('google-auth-library');
var { google } = require('googleapis');
var OAuth2 = google.auth.OAuth2;
var letterParser = require('./letter-parser');
// var PDF = require('pdfkit');
const HummusRecipe = require('hummus-recipe');
const fs = require('fs');
const Readable = require('stream').Readable;

router.get('/', function (req, res, next) {
    req.user.getForm(req.query.id, function (err, form) {
        if (err) {
            console.log("get /  error in letter-preivew: " + err );
        } else {
            console.log("id when loading page? " + req.query.id);
            res.render('pages/letter-preview', {
                title: form.email,
                templates: req.user.getEmailTemplates(),
                id: req.query.id,
                form: form,
            });
        }
    });
});

router.get('/form', function (req, res, next) {
    req.user.getForm(req.query.id, function (err, form) {
        if (err) {
            console.log(err);
        } else {
            res.json(form);
        }
    });
});

router.get('/emailForm', function (req, res, next) {
    req.user.getForm(req.query.id, function (err, form) {
        if (err) {
            console.log("/form error:  "  + err);
        } else {
            res.json({
                form: form,
                id: req.query.id
            });
        }
    });
});

router.post('/save', function (req, res, next) {
    Form.completeForm(req.body.id, req.body.letter, function (err, form) {
        if (err) {
            console.log(err);
        } else {
            // res.render({
            //     success: "Updated Successfully",
            //     status: 200
            // });
            res.render('pages/letter-preview', {
                title: form.email,
                templates: req.user.getEmailTemplates(),
                id: req.query.id,
                form: form,
            });
        }
    });
});

router.post('/', function (req, res, next) {
    console.log("/post is called");
    console.log("id? " + req.body.id);

    req.user.addEmailHistory(req.body.Email, function (err, form){
        if (err) {
            console.log("get form in /addEmailHistory " + err);
        } 
    }),
    req.user.getForm(req.body.id, function (err, form) {
        if (err) {
            console.log("get form in / " + err);
        } else {
            //console.log("got Form, not setEmailSent");
            Form.setEmailSent(req.body.id, function (err, form) {
                if (err) {
                    console.log("setEmailSent in / " + err);
                } else {
                    //console.log("setEmailSent, nowaddEHF");
                    form.addEmailHistory_Form(req.body.Email, function (err, id) {
                        if (err) {
                            console.log("add email history " +err);
                        } else {
                            console.log("got into _Form");
                            var email = form.email; // temp
                            var gmailClass = google.gmail('v1');
                            var email_lines = [];
                            var toEmail = email; // testing
                            var email_title = req.body.Email.subject;
                            var email_body = req.body.Email.body_text;                           
                            email_body = email_body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;").replace(/\n/gi, '<br>');
                       
                            //email_lines.push('From: "test"');
                            email_lines.push('To: ' + toEmail);
                            email_lines.push('Content-type: text/html;charset=iso-8859-1');
                            email_lines.push('MIME-Version: 1.0');
                            email_lines.push('Subject: ' + email_title);
                            email_lines.push('');
                            email_lines.push(email_body);
                        
                            var email = email_lines.join('\r\n').trim();
                            var base64EncodedEmail = new Buffer(email).toString('base64');
                            base64EncodedEmail = base64EncodedEmail.replace(/\+/g, '-').replace(/\//g, '_');
                        
                            var auth = new googleAuth();
                            var oauth2Client = new OAuth2(credentials.clientId, credentials.clientSecret, credentials.clientCallback);
                            oauth2Client.setCredentials(req.user.accessToken);
                        
                            gmailClass.users.messages.send({
                                access_token: req.user.accessToken,
                                userId: 'me',
                                resource: {
                                    raw: base64EncodedEmail
                                }
                            });

                            res.redirect('/recommender-dashboard');
                        }
                    }
                ); 
                }
            });
        }
    });
});

router.post('/drive', function(req,res,next) {
    var user = req.user;
    // console.log("BODY ID:" + req.body.id)
    // console.log("LETTER FROM REQ:" + req.body.letter)
    user.getForm(req.body.id, function(err, form) {
        if(err){
            console.log(err)
        } else {
            var template = form.getTemplate();
            // var text = template.text;
            var templateName = template.name;
            console.log("WHAT:" + req.body.letter)
            var text = letterParser.htmlstuff(req.body.letter)
            console.log("TEXT REMAINING" + text)
            // console.log("form" + form)
            var fname = form.responses[0].response;
            var lname = form.responses[1].response;

            var headerImg = template.letterheadImg;

            var base64header = headerImg.split("base64,")[1];

            const bufHeader = Buffer.from(base64header, 'base64');


            var headStream = new Readable();
            headStream.push(bufHeader);
            headStream.push(null);
            var headerPathP = __dirname + '/uploads/' + 'header.pdf';
            var headerPath = __dirname + '/uploads/' + 'template.pdf';

            headStream.pipe(fs.createWriteStream(headerPathP));
            // headsteam.on('er')
            headStream.on('data', function () {
                // var outputName = templateName + "Template_" + fname + "_" + lname + ".docx";
                var outputName = templateName + "_Template_" + fname + "_" + lname + ".pdf";
                var output = __dirname + '/uploads/' + outputName;

                console.log('IM DONE')
                const HummusRecipe = require('hummus-recipe');
                const pdfDoc = new HummusRecipe(headerPath, output);
                pdfDoc
                    // edit 1st page
                    .editPage(1)
                    .text(text, 85, 120, {
                        color: '000000',
                        font: 'Times New Roman',
                        fontSize: 9,
                        align: 'left',
                        textBox: {
                            width: 480,
                            lineHeight: 12,
                            style: {
                                lineWidth: 1
                            }
                        }
                    })
                    
                    .endPage()
                    .endPDF();
                res.redirect('/recommender-dashboard');

            })
        }

    })
})



module.exports = router;