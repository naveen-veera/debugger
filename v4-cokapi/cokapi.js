var assert = require('assert');
var child_process = require('child_process');
var express = require('express');
var util = require('util');
var queue = require('express-queue');
var request = require('request');
var PORT = 8000;
var useHttps = false;
var local = false;
var args = process.argv.slice(2);
if (args.length > 0) {
    if (args[0] === 'https') {
        PORT = 443;
        useHttps = true;
    } else if (args[0] === 'http3000') {
        PORT = 3000;
    } else if (args[0] === 'https8001') {
        PORT = 8001;
        useHttps = true;
    } else if (args[0] === 'local') {
        PORT = 3000;
        local = true;
        console.log('running in local mode');
    } else {
        assert(false);
    }
}

var TIMEOUT_SECS = 60;

var MAX_BUFFER_SIZE = 10 * 1024 * 1024;

var MEM_LIMIT = "256m";

function sendDataToStudent(isStudent,trace,language,metadata) {
    
    let postData;
    if (isStudent) {
        postData = {
            language,
            trace,
            school_id: metadata.school_id,
            c_id: metadata.c_id,
            t_id: metadata.t_id,
            attempt_no: metadata.attempt_no,
            user_id: metadata.user_id,
            q_id: metadata.q_id,
            isStudent:isStudent
        };
    } else {
        postData = {
            trace,
            isStudent: isStudent,
	    school_id: metadata.school_id,
        user_id: metadata.user_id,
        random_id: metadata.random_id
        };
    }
    let urlForStage = 'https://api.examly.io/api/sendDebugDataToStudent';
    var clientServerOptions = {
        uri: urlForStage,
        body: JSON.stringify(postData),
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }
    request(clientServerOptions, function (error, response) {
	console.log(error);
        return;
    });

}

function postExecHandler(language,isStudent, metadata ,res, err, stdout, stderr) {
    var errTrace;

    if (err) {
        console.log('postExecHandler', util.inspect(err, { depth: null }));
        if (err.killed) {
            // timeout!
            errTrace = {
                code: '', trace: [{
                    'event': 'uncaught_exception',
                    'exception_msg': 'Error: Your code ran for more than ' + TIMEOUT_SECS + ' seconds. It may have an INFINITE LOOP.\nOr the server may be OVERLOADED right now.\nPlease try again later, or shorten your code.'
                }]
            };

            // sendDataToStudent(isStudent,errTrace,language,metadata);
            res.jsonp(errTrace /* return an actual object, not a string */);

        } else {
            if (err.code === 42) {
                // special error code for instruction_limit_reached in jslogger.js
                errTrace = {
                    code: '', trace: [{
                        'event': 'uncaught_exception',
                        'exception_msg': 'Error: stopped after running 1000 steps and cannot display visualization.\nShorten your code, since Debugger is not designed to handle long-running code.'
                    }]
                };
                res.jsonp(errTrace /* return an actual object, not a string */);
            } else {
                errTrace = {
                    code: '', trace: [{
                        'event': 'uncaught_exception',
                        'exception_msg': "Unknown error. The server may be OVERLOADED right now; please try again later."
                    }]
                };
                res.status(400);
                res.send(errTrace /* return an actual object, not a string */);
                // old error message, retired on 2018-03-02
                //'exception_msg': "Unknown error. The server may be down or overloaded right now.\nReport a bug to philip@pgbovine.net by clicking on the\n'Generate permanent link' button at the bottom and including a URL in your email."}]};
            }
            // sendDataToStudent(isStudent,errTrace,language,metadata);
            

        }
    } else {
        try {
            // stdout better be real JSON, or we've got a problem!!!
            var stdoutParsed = JSON.parse(stdout);
            
            // sendDataToStudent(isStudent,stdoutParsed,language,metadata);
            res.jsonp(stdoutParsed /* return an actual object, not a string */);
        } catch (e) {
            errTrace = {
                code: '', trace: [{
                    'event': 'uncaught_exception',
                    'exception_msg': "Unknown error. The parser may be OVERLOADED right now; please try again later"
                }]
            };
            // old error message, retired on 2018-03-02
            //'exception_msg': "Unknown error. The server may be down or overloaded right now.\nReport a bug to philip@pgbovine.net by clicking on the\n'Generate permanent link' button at the bottom and including a URL in your email."}]};
            // sendDataToStudent(isStudent,errTrace,language,metadata);
            res.jsonp(errTrace /* return an actual object, not a string */);
        }
    }
}

var app = express();
app.use(queue({ activeLimit:12, queuedLimit: -1 }));
var bodyParser = require('body-parser');

app.use(bodyParser.json());
app.post('/debug', exec_debugger.bind(null));
function exec_debugger(req, res) {
     req.socket.setTimeout(300000);
     //res.send(req.body);
    const user_code = req.body.payload.user_code;
    const language = req.body.payload.language;
    const val = req.body.payload;
    let isStudent = false;
    let metadata = null;
    if(val.isStudent){
        isStudent = true;
        metadata = {
            language: val.language,
            school_id: val.school_id,
            c_id: val.c_id,
            t_id: val.t_id,
            attempt_no: val.attempt_no,
            user_id: val.user_id,
            q_id: val.q_id
        };
    } else {
        isStudent = false;
        metadata = {
            language: val.language,
	    school_id: val.school_id,
        user_id: val.user_id,
        random_id: val.random_id
        }
    }
//    const raw_input = req.body.payload.raw_input;
 const raw_input = '';  
 console.log('---- user_code ----\n', user_code);
  switch (language) {
        case 'java': {
            var usrCod = user_code;
            var exeFile;
            var args = [];
            var inputObj = {};
            inputObj.usercode = usrCod;
            // TODO: add options, arg, and stdin later ...
            inputObj.options = {};
            inputObj.args = [];
            inputObj.stdin = ""; // TODO: Can add stdin
            var inputObjJSON = JSON.stringify(inputObj);
            // must match the docker setup in backends/java/Dockerfile
            exeFile = 'docker'; // absolute path to docker executable
            // for mac docker
            // for linux /usr/bin/docker
            args.push('run', '-m', MEM_LIMIT , '--rm', '--user=netuser', '--net=none', '--cap-drop', 'all', 'pgbovine/cokapi-java:v1',
                '/tmp/run-java-backend.sh',
                inputObjJSON);
            child_process.execFile(exeFile, args,
                {
                    timeout: TIMEOUT_SECS * 1000 /* milliseconds */,
                    maxBuffer: MAX_BUFFER_SIZE,
                    // make SURE docker gets the kill signal;
                    // this signal seems to allow docker to clean
                    // up after itself to --rm the container, but
                    // double-check with 'docker ps -a'
                    killSignal: 'SIGINT'
                },
                postExecHandler.bind(null,language,isStudent,metadata ,res));
        }
            break;
        case 'javascript': {
            var usrCod = user_code;

            var exeFile;
            var args = [];

            // must match the docker setup in backends/javascript/Dockerfile
            exeFile = '/usr/bin/docker'; // absolute path to docker executable
            args.push('run', '-m', MEM_LIMIT, '--rm', '--user=netuser', '--net=none', '--cap-drop', 'all', 'pgbovine/cokapi-js:v1',
                '/tmp/javascript/node-v6.0.0-linux-x64/bin/node', // custom Node.js version
                '--expose-debug-as=Debug',
                '/tmp/javascript/jslogger.js');

            args.push('--jsondump=true');
            args.push('--code=' + usrCod);

            child_process.execFile(exeFile, args,
                {
                    timeout: TIMEOUT_SECS * 1000 /* milliseconds */,
                    maxBuffer: MAX_BUFFER_SIZE,
                    // make SURE docker gets the kill signal;
                    // this signal seems to allow docker to clean
                    // up after itself to --rm the container, but
                    // double-check with 'docker ps -a'
                    killSignal: 'SIGINT'
                },
                postExecHandler.bind(null,language,isStudent,metadata ,res));
        }
            break;
        case 'python': {
            var usrCod = user_code;
            var exeFile;
            var args = [];
            // must match the docker setup in backends/javascript/Dockerfile
            exeFile = '/usr/bin/docker'; // absolute path to docker executable
            args.push('run', '-m', MEM_LIMIT, '--rm', '--user=netuser', '--net=none', '--cap-drop', 'all', 'pgbovine/cokapi-python-anaconda:v1',
                'python',
                '/tmp/python/generate_json_trace.py',
                '--allmodules', // freely allow importing of all modules
                '--code=' + usrCod);
            args.push('--heapPrimitives');
            args.push('--cumulative');
            //args.push('--input=' + '"ss"');
            child_process.execFile(exeFile, args,
                {
                    timeout: TIMEOUT_SECS * 1000 /* milliseconds */,
                    maxBuffer: MAX_BUFFER_SIZE,
                    // make SURE docker gets the kill signal;
                    // this signal seems to allow docker to clean
                    // up after itself to --rm the container, but
                    // double-check with 'docker ps -a'
                    killSignal: 'SIGINT'
                },
                postExecHandler.bind(null,language,isStudent,metadata ,res));
        }
            break;
        case 'ruby': {
            var usrCod = user_code;

            var exeFile;
            var args = [];

            // must match the docker setup in backends/ruby/Dockerfile
            exeFile = '/usr/bin/docker'; // absolute path to docker executable
            args.push('run', '-m', MEM_LIMIT, '--rm','--user=netuser', '--net=none', '--cap-drop', 'all', 'pgbovine/cokapi-ruby:v1',
                '/tmp/ruby/ruby',
                '/tmp/ruby/pg_logger.rb',
                '-c',
                usrCod);

            child_process.execFile(exeFile, args,
                {
                    timeout: TIMEOUT_SECS * 1000 /* milliseconds */,
                    maxBuffer: MAX_BUFFER_SIZE,
                    // make SURE docker gets the kill signal;
                    // this signal seems to allow docker to clean
                    // up after itself to --rm the container, but
                    // double-check with 'docker ps -a'
                    killSignal: 'SIGINT'
                },
                postExecHandler.bind(null,language,isStudent,metadata ,res));
        }
            break;
        case 'c': {
            var usrCod = user_code;
            var exeFile;
            var args = [];
            // must match the docker setup in backends/c_cpp/Dockerfile
            exeFile = '/usr/bin/docker'; // absolute path to docker executable
            args.push('run', '-m', MEM_LIMIT,'--rm', '--user=netuser', '--net=none', '--cap-drop', 'all', 'pgbovine/opt-cpp-backend:v1',
                'python',
                '/tmp/opt-cpp-backend/run_cpp_backend.py',
                usrCod,
                'cpp');
            child_process.execFile(exeFile, args,
                {
                    timeout: TIMEOUT_SECS * 1000 /* milliseconds */,
                    maxBuffer: MAX_BUFFER_SIZE,
                    // make SURE docker gets the kill signal;
                    // this signal seems to allow docker to clean
                    // up after itself to --rm the container, but
                    // double-check with 'docker ps -a'
                    killSignal: 'SIGINT'
                },
                postExecHandler.bind(null,language,isStudent,metadata ,res));
        }
            break;
        case 'cpp': {
            var usrCod = user_code;
            var exeFile;
            var args = [];
            // must match the docker setup in backends/c_cpp/Dockerfile
            exeFile = '/usr/bin/docker'; // absolute path to docker executable
            args.push('run', '-m', MEM_LIMIT, '--rm', '--user=netuser', '--net=none', '--cap-drop', 'all', 'pgbovine/opt-cpp-backend:v1',
                'python',
                '/tmp/opt-cpp-backend/run_cpp_backend.py',
                usrCod,
                'cpp');
            child_process.execFile(exeFile, args,
                {
                    timeout: TIMEOUT_SECS * 1000 /* milliseconds */,
                    maxBuffer: MAX_BUFFER_SIZE,
                    // make SURE docker gets the kill signal;
                    // this signal seems to allow docker to clean
                    // up after itself to --rm the container, but
                    // double-check with 'docker ps -a'
                    killSignal: 'SIGINT'
                },
                postExecHandler.bind(null,language,isStudent,metadata ,res));
        }
            break;
        default:
            res.send({
                success: false,
                data: 'Not supported'
            });
            break;
    }

}

// app.post('/exec_java', exec_java_handler.bind(null, true));
// app.post('/exec_c', exec_c_cpp_handler.bind(null, false, true));
// app.post('/exec_cpp', exec_c_cpp_handler.bind(null, true, true));
// app.post('/exec_ruby', exec_ruby_handler.bind(null, true));
// app.post('/exec_python', exec_python_handler.bind(null, true));
// app.post('/exec_javascript', exec_js_handler.bind(null, true));
app.get('/debug', (req, res) => {
    res.send('Its working fine');
});

var https = require('https');
var fs = require('fs');

if (useHttps) {
    // added letsencrypt support on 2017-06-28 -- MAKE SURE we have read permissions
    var options = {
        key: fs.readFileSync('/etc/letsencrypt/live/cokapi.com/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/cokapi.com/cert.pem'),
        ca: fs.readFileSync('/etc/letsencrypt/live/cokapi.com/chain.pem')
    };

    var server = https.createServer(options, app).listen(
        PORT,
        function () {
            var host = server.address().address;
            var port = server.address().port;
            console.log('https app listening at https://%s:%s', host, port);
        });
} else {
    var server = app.listen(
        PORT,
        function () {
            var host = server.address().address;
            var port = server.address().port;
            console.log('http app listening at http://%s:%s', host, port);
        });
    }
