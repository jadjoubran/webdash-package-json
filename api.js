const exec = require('child_process').exec;
const fs = require('fs');
const path = require('path');

const canUseYarn = () => {
    return fs.existsSync('yarn.lock');
};
const useYarn = canUseYarn();

const commands = {
    list: 'npm list --depth=0 --json',
    outdated: 'npm outdated --json',
    update: 'npm update',
}

if (useYarn) {
    commands.list = 'yarn list --depth=0 --json --no-progress';
    commands.update = 'yarn update';
    //outdated is safe to be used by npm
}

const yarnGetPkgName = (pkg) => {
    return pkg.name.substr(0, pkg.name.indexOf('@'));
}

const yarnGetPkgVersion = (pkg) => {
    return pkg.name.substr(pkg.name.indexOf('@') + 1);
}

module.exports = {
    routes: {
        get: {
            'package-json': (req, res) => {
                exec(commands.list, (error, list) => {
                    if (error !== null) {
                        console.log('exec error: ' + error);
                        return;
                    }
                    let result;
                    if (useYarn) {
                        //need to filter out packages that are not in package.json
                        const appRoot = req.app.locals.appRoot;
                        const packageJson = require(`${appRoot}/package.json`);
                        const deps = [...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies)];
                        let installed = JSON.parse(list).data.trees;
                        installed = installed.filter(pkg => deps.includes(yarnGetPkgName(pkg)));

                        let result = {};
                        for (const pkg of installed) {
                            result[yarnGetPkgName(pkg)] = {
                                version: yarnGetPkgVersion(pkg)
                            };
                        }
                        res.send({ result });
                    } else {
                        result = JSON.parse(list).dependencies;
                        res.send({ result });
                    }
                });
            },
            'outdated': (req, res) => {
                exec(commands.outdated, (error, outdated) => {
                    /* unexpected behavior in npm
                    * npm outdated returns status code 1 rather than 0
                    thus we're not checking for error */

                    const result = JSON.parse(outdated);
                    res.send({ result });
                });
            }
        },
        post: {
            'update': (req, res) => {
                const body = req.body
                if (!body || !body.name) {
                    res.send(false);
                }
                exec(`${commands.update} ${body.name}`, (error, response) => {
                    if (error !== null) {
                        console.log('exec error: ' + error);
                        return;
                    }
                    res.send({ result: true });
                });
            }
        }
    }
}
