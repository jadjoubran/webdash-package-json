const exec = require("child_process").exec;
const fs = require("fs");
const path = require("path");

const canUseYarn = () => {
  return fs.existsSync("yarn.lock");
};
const useYarn = canUseYarn();

const commands = {
  list: "npm list --depth=0 --json --silent",
  outdated: "npm outdated --json --silent",
  update: "npm update --silent"
};

if (useYarn) {
  commands.list = "yarn list --depth=0 --json --no-progress --silent";
  commands.update = "yarn upgrade --silent";
  //outdated is safe to be used by npm
}

const yarnGetPkgName = pkg => {
  return pkg.name.substr(0, pkg.name.indexOf("@"));
};

const yarnGetPkgVersion = pkg => {
  return pkg.name.substr(pkg.name.indexOf("@") + 1);
};

const options = { maxBuffer: 1024 * 100000 };

module.exports = {
  routes: {
    get: {
      "package-json": (req, res) => {
        const appRoot = req.app.locals.appRoot;

        exec(commands.list, options, (error, list) => {
           /* unexpected behavior in npm
            * npm list returns status code 1 when unmet deps
            * thus we're not checking for error */
          let result = {};

          if (!list){
            return res.send({ result });
          }

          let installed = [];
          try {
            installed = JSON.parse(list);
            if (!installed){
              return res.send({ result })
            }
          } catch (error) {
            console.log('There was an error');
            console.log(error);
            return res.send({ result })
          }

          if (!fs.existsSync(`${appRoot}/package.json`)) {
            return res.send({ result });
          }
          if (useYarn) {
            installed = installed.data.trees;
            //need to filter out packages that are not in package.json
            const appRoot = req.app.locals.appRoot;
            const packageJson = require(`${appRoot}/package.json`);
            const deps = [
              ...Object.keys(packageJson.dependencies || {}),
              ...Object.keys(packageJson.devDependencies || {})
            ];

            installed = installed.filter(pkg =>
              deps.includes(yarnGetPkgName(pkg))
            );

            let result = {};
            for (const pkg of installed) {
              result[yarnGetPkgName(pkg)] = {
                version: yarnGetPkgVersion(pkg)
              };
            }
            res.send({ result });
          } else {
            try {
              result = installed.dependencies;
            } catch (error) {}
            res.send({ result });
          }
        });
      },
      outdated: (req, res) => {
        exec(commands.outdated, options, (error, outdated) => {
          /* unexpected behavior in npm
            * npm outdated returns status code 1 rather than 0
            * thus we're not checking for error */

          //outdated will be empty if there are no outdated packages
          if (!outdated) {
            return res.send({ result: false });
          }
          let result = {};
          try {
            result = JSON.parse(outdated);
          } catch (error) {}
          res.send({ result });
        });
      }
    },
    post: {
      update: (req, res) => {
        const body = req.body;
        if (!body || !body.name) {
          res.send(false);
        }
        exec(`${commands.update} ${body.name}`, options, (error, response) => {
          if (error !== null) {
            console.log("exec error: " + error);
            return;
          }
          res.send({ result: true });
        });
      }
    }
  }
};
