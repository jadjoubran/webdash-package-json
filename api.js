module.exports = {
    routes: {
        get: {
            'package-json': (req, res) => {
                // const package = require('./../../package.json');
                // const result = { package };

                // res.send(result);

                const exec = require('child_process').exec

                exec('npm list --depth=0 --json', (error, response) => {
                    if (error !== null) {
                        console.log('exec error: ' + error);
                        return;
                    }
                    const result = JSON.parse(response).dependencies;

                    res.send({result});
                });
            }
        }
    }
}